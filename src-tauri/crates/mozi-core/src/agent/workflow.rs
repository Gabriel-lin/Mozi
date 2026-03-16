#![allow(dead_code)]
//! # WorkflowAgent
//!
//! 基于有向无环图（DAG）的工作流代理。
//!
//! ## 设计理念
//!
//! 将一个复杂任务拆解为若干**节点**，节点间的依赖关系通过有向边表达；
//! `WorkflowAgent` 按拓扑序依次执行节点，每个节点可以是：
//!
//! - **工具调用（ToolCall）**：直接调用已注册工具
//! - **技能调用（SkillCall）**：调用已注册技能
//! - **子代理调用（AgentCall）**：将子任务分派给另一个 Agent
//! - **决策分支（Decision）**：根据前驱节点的输出选择后继路径
//!
//! ## DAG 结构
//!
//! ```text
//!  [Start] ──► [ToolCall: search] ──► [Decision] ──► [SkillCall: summarize] ──► [End]
//!                                          └──────────► [AgentCall: writer]  ──► [End]
//! ```

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::context::{ContextRegistrar, ContextWindow};
use crate::errors::{AgentError, ContextError, SkillsError};
use crate::skills::{Skill, SkillMeta, SkillRegistrar, SkillStore};
use crate::tools::registry::{Tool, ToolCategory, ToolMeta, ToolRegistrar, ToolStore, ToolType};
use crate::tools::ToolError;

use super::traits::Agent;
use super::types::{AgentMeta, AgentStatus, AgentStep};

// ─────────────────────────── DAG 节点类型 ────────────────────────────────────

/// DAG 节点执行类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum NodeKind {
    /// 调用已注册工具
    ToolCall {
        tool_id: String,
        params: serde_json::Value,
    },
    /// 调用已注册技能
    SkillCall {
        skill_id: String,
        params: serde_json::Value,
    },
    /// 分派给子代理（异步）
    AgentCall { agent_id: String, goal: String },
    /// 条件分支（表达式由实现层求值）
    Decision {
        condition: String,
        true_branch: String,
        false_branch: String,
    },
    /// 起始哨兵节点
    Start,
    /// 终止哨兵节点
    End,
}

/// DAG 节点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagNode {
    /// 节点唯一 ID
    pub id: String,
    /// 节点描述（供调试/日志）
    pub label: String,
    /// 节点类型与参数
    pub kind: NodeKind,
    /// 后继节点 ID 列表（拓扑边）
    pub next: Vec<String>,
}

/// 节点执行状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Pending,
    Running,
    Completed,
    Failed(String),
    Skipped,
}

// ─────────────────────────── WorkflowGraph ───────────────────────────────────

/// 工作流 DAG（纯数据，不含执行逻辑）
#[derive(Debug, Clone, Default)]
pub struct WorkflowGraph {
    /// 节点表（id → DagNode）
    nodes: HashMap<String, DagNode>,
    /// 起始节点 ID
    entry: Option<String>,
}

impl WorkflowGraph {
    pub fn new() -> Self {
        Self::default()
    }

    /// 添加节点；重复 ID 将覆盖旧节点
    pub fn add_node(&mut self, node: DagNode) {
        if matches!(node.kind, NodeKind::Start) {
            self.entry = Some(node.id.clone());
        }
        self.nodes.insert(node.id.clone(), node);
    }

    /// 获取入口节点
    pub fn entry_node(&self) -> Option<&DagNode> {
        self.entry.as_deref().and_then(|id| self.nodes.get(id))
    }

    /// 按节点 ID 获取节点
    pub fn get_node(&self, id: &str) -> Option<&DagNode> {
        self.nodes.get(id)
    }

    /// 拓扑排序（Kahn 算法），返回执行序列或检测到环时报错
    pub fn topological_order(&self) -> Result<Vec<String>, AgentError> {
        let mut in_degree: HashMap<&str, usize> =
            self.nodes.keys().map(|k| (k.as_str(), 0)).collect();
        for node in self.nodes.values() {
            for next_id in &node.next {
                *in_degree.entry(next_id.as_str()).or_insert(0) += 1;
            }
        }
        let mut queue: Vec<&str> = in_degree
            .iter()
            .filter_map(|(&id, &deg)| if deg == 0 { Some(id) } else { None })
            .collect();
        let mut order = Vec::new();
        while let Some(id) = queue.pop() {
            order.push(id.to_string());
            if let Some(node) = self.nodes.get(id) {
                for next_id in &node.next {
                    let deg = in_degree.entry(next_id.as_str()).or_insert(0);
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(next_id.as_str());
                    }
                }
            }
        }
        if order.len() != self.nodes.len() {
            return Err(AgentError::GoalInvalid(
                "工作流 DAG 存在环，无法执行".into(),
            ));
        }
        Ok(order)
    }
}

// ─────────────────────────── WorkflowAgent ───────────────────────────────────

pub struct WorkflowAgent {
    meta: AgentMeta,
    status: AgentStatus,
    graph: WorkflowGraph,
    /// 各节点执行状态
    node_status: HashMap<String, NodeStatus>,
    /// 每步对应的 AgentStep 记录
    steps: Vec<AgentStep>,
    tool_store: ToolStore,
    skill_store: SkillStore,
    context: Option<ContextWindow>,
}

impl WorkflowAgent {
    pub fn new(meta: AgentMeta, graph: WorkflowGraph) -> Self {
        Self {
            meta,
            status: AgentStatus::Idle,
            graph,
            node_status: HashMap::new(),
            steps: Vec::new(),
            tool_store: ToolStore::new(),
            skill_store: SkillStore::new(),
            context: None,
        }
    }

    /// 返回 DAG 的只读引用（供外部查看结构）
    pub fn graph(&self) -> &WorkflowGraph {
        &self.graph
    }

    /// 获取指定节点当前状态
    pub fn node_status(&self, id: &str) -> Option<&NodeStatus> {
        self.node_status.get(id)
    }
}

// ── Agent trait ───────────────────────────────────────────────────────────────

impl Agent for WorkflowAgent {
    fn meta(&self) -> &AgentMeta {
        &self.meta
    }

    fn status(&self) -> AgentStatus {
        self.status.clone()
    }

    fn run(
        &mut self,
        _goal: &str,
        _params: HashMap<String, serde_json::Value>,
    ) -> Result<String, AgentError> {
        // 校验 DAG 可执行
        self.graph.topological_order()?;

        self.node_status.clear();
        self.steps.clear();
        self.status = AgentStatus::Planning;

        // 将所有节点初始化为 Pending
        for id in self.graph.nodes.keys() {
            self.node_status.insert(id.clone(), NodeStatus::Pending);
        }

        Ok(uuid::Uuid::new_v4().to_string())
    }

    fn step(&mut self) -> Result<AgentStep, AgentError> {
        // 取下一个 Pending 节点（按拓扑序第一个入度为 0 的节点）
        let order = self.graph.topological_order()?;
        let next_id = order
            .iter()
            .find(|id| self.node_status.get(id.as_str()) == Some(&NodeStatus::Pending))
            .cloned();

        let node_id = next_id.ok_or_else(|| AgentError::Stopped(self.meta.id.clone()))?;

        self.node_status
            .insert(node_id.clone(), NodeStatus::Running);
        self.status = AgentStatus::Executing;

        // TODO: 根据 NodeKind 实际执行工具/技能/子代理
        let step = AgentStep {
            step_id: (self.steps.len() + 1) as u32,
            thought: Some(format!("执行 DAG 节点: {}", node_id)),
            action: Some(node_id.clone()),
            action_input: None,
            observation: None,
        };
        self.node_status.insert(node_id, NodeStatus::Completed);
        self.steps.push(step.clone());
        Ok(step)
    }

    fn stop(&mut self) -> Result<(), AgentError> {
        self.status = AgentStatus::Failed("手动停止".into());
        Ok(())
    }

    fn history(&self) -> &[AgentStep] {
        &self.steps
    }
}

// ── ToolRegistrar ─────────────────────────────────────────────────────────────

impl ToolRegistrar for WorkflowAgent {
    fn register_tool(&mut self, tool: Arc<dyn Tool>) -> Result<(), ToolError> {
        self.tool_store.register_tool(tool)
    }
    fn unregister_tool(&mut self, id: &str) -> Result<(), ToolError> {
        self.tool_store.unregister_tool(id)
    }
    fn get_tool(&self, id: &str) -> Option<Arc<dyn Tool>> {
        self.tool_store.get_tool(id)
    }
    fn list_tools(&self) -> Vec<ToolMeta> {
        self.tool_store.list_tools()
    }
    fn list_tools_by_category(&self, category: &ToolCategory) -> Vec<ToolMeta> {
        self.tool_store.list_tools_by_category(category)
    }
    fn list_tools_by_type(&self, tool_type: &ToolType) -> Vec<ToolMeta> {
        self.tool_store.list_tools_by_type(tool_type)
    }
}

// ── SkillRegistrar ────────────────────────────────────────────────────────────

impl SkillRegistrar for WorkflowAgent {
    fn register_skill(&mut self, skill: Arc<dyn Skill>) -> Result<(), SkillsError> {
        self.skill_store.register_skill(skill)
    }
    fn unregister_skill(&mut self, id: &str) -> Result<(), SkillsError> {
        self.skill_store.unregister_skill(id)
    }
    fn get_skill(&self, id: &str) -> Option<Arc<dyn Skill>> {
        self.skill_store.get_skill(id)
    }
    fn list_skills(&self) -> Vec<SkillMeta> {
        self.skill_store.list_skills()
    }
}

// ── ContextRegistrar ──────────────────────────────────────────────────────────

impl ContextRegistrar for WorkflowAgent {
    fn attach_context(&mut self, ctx: ContextWindow) -> Result<(), ContextError> {
        self.context = Some(ctx);
        Ok(())
    }
    fn detach_context(&mut self) -> Result<(), ContextError> {
        self.context
            .take()
            .map(|_| ())
            .ok_or(ContextError::NotAttached)
    }
    fn context(&self) -> Option<&ContextWindow> {
        self.context.as_ref()
    }
    fn context_mut(&mut self) -> Option<&mut ContextWindow> {
        self.context.as_mut()
    }
}
