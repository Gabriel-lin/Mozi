#![allow(dead_code)]
//! # CollaborativeSwarm — 对等协作集群
//!
//! 对等协作模式下，所有 Agent **地位平等**，通过 `MessageBus` 共享中间结果；
//! 适合并行任务、数据管道和投票/共识场景。
//!
//! ## 与 MasterSlave 的对比
//!
//! | 维度          | MasterSlaveSwarm            | CollaborativeSwarm            |
//! |-------------|----------------------------|-------------------------------|
//! | 任务分解      | MasterAgent 负责             | 预先设计好的任务列表             |
//! | Agent 关系    | 层级（主/从）                 | 平等（Peer-to-Peer）           |
//! | 通信方式      | Master → Sub（单向指令）      | 广播 + 点对点消息               |
//! | 结果聚合      | Master 汇总                 | 投票 / 合并策略                 |
//!
//! ## 内部结构
//!
//! ```text
//! CollaborativeSwarm
//!  ├── agent_store : AgentStore
//!  ├── tool_store  : ToolStore
//!  ├── context     : Option<ContextWindow>
//!  ├── bus         : MessageBus        (对等消息路由)
//!  └── sub_tasks   : Vec<SubTask>
//! ```

use std::collections::HashMap;
use std::sync::Arc;

use crate::agent::{Agent, AgentMeta, AgentRegistrar, AgentStore};
use crate::context::{ContextRegistrar, ContextWindow};
use crate::errors::{AgentError, ContextError, SwarmError};
use crate::tools::registry::{Tool, ToolCategory, ToolMeta, ToolRegistrar, ToolStore, ToolType};
use crate::tools::ToolError;

use super::coordinator::{MessageBus, SwarmEvent};
use super::traits::Swarm;
use super::types::{AggregatedResult, SubTask, SwarmMeta, SwarmMode, SwarmStatus, TaskPriority};

// ─────────────────────────── CollaborativeSwarm ───────────────────────────────

pub struct CollaborativeSwarm {
    meta: SwarmMeta,
    status: SwarmStatus,
    agent_store: AgentStore,
    tool_store: ToolStore,
    context: Option<ContextWindow>,
    bus: MessageBus,
    sub_tasks: Vec<SubTask>,
}

impl CollaborativeSwarm {
    pub fn new(meta: SwarmMeta) -> Self {
        assert_eq!(
            meta.mode,
            SwarmMode::Collaborative,
            "CollaborativeSwarm 需要 Collaborative 模式"
        );
        Self {
            meta,
            status: SwarmStatus::Idle,
            agent_store: AgentStore::new(),
            tool_store: ToolStore::new(),
            context: None,
            bus: MessageBus::new(),
            sub_tasks: Vec::new(),
        }
    }

    /// 向指定 Agent 发送点对点消息
    pub fn send_message(&mut self, from: &str, to: &str, payload: serde_json::Value) {
        self.bus.publish(SwarmEvent::AgentMessage {
            from: from.to_string(),
            to: Some(to.to_string()),
            payload,
        });
    }

    /// 广播消息给所有 Agent
    pub fn broadcast(&mut self, from: &str, payload: serde_json::Value) {
        self.bus.publish(SwarmEvent::AgentMessage {
            from: from.to_string(),
            to: None,
            payload,
        });
    }

    /// 取出发给指定 Agent 的所有消息
    pub fn drain_mailbox(&mut self, agent_id: &str) -> Vec<serde_json::Value> {
        self.bus.drain_mailbox(agent_id)
    }

    /// 返回消息总线的只读引用
    pub fn bus(&self) -> &MessageBus {
        &self.bus
    }

    /// 预置子任务列表（不依赖 LLM 拆解，适合已知任务结构的场景）
    pub fn preset_tasks(&mut self, tasks: Vec<SubTask>) {
        self.sub_tasks = tasks;
    }
}

// ── Swarm trait ───────────────────────────────────────────────────────────────

impl Swarm for CollaborativeSwarm {
    fn meta(&self) -> &SwarmMeta {
        &self.meta
    }

    fn status(&self) -> SwarmStatus {
        self.status.clone()
    }

    fn dispatch(&mut self, goal: &str) -> Result<String, SwarmError> {
        if goal.trim().is_empty() {
            return Err(SwarmError::DispatchFailed("目标不能为空".into()));
        }
        self.status = SwarmStatus::Running;

        let agents = self.agent_store.list_agents();
        if agents.is_empty() {
            return Err(SwarmError::DispatchFailed("无可用 Agent".into()));
        }

        // 对等协作：将整体目标平均拆分给所有 Agent
        let dispatch_id = uuid::Uuid::new_v4().to_string();
        let tasks: Vec<SubTask> = agents
            .iter()
            .map(|a| {
                let task = SubTask::new(
                    uuid::Uuid::new_v4().to_string(),
                    &a.id,
                    format!("[协作] {} （由 {} 处理）", goal, a.name),
                );
                self.bus.publish(SwarmEvent::TaskDispatched {
                    task_id: task.task_id.clone(),
                    agent_id: task.agent_id.clone(),
                    goal: task.goal.clone(),
                });
                task
            })
            .collect();

        self.sub_tasks = tasks;
        Ok(dispatch_id)
    }

    fn sub_tasks(&self) -> &[SubTask] {
        &self.sub_tasks
    }

    fn aggregate_results(&self) -> AggregatedResult {
        let succeeded = self
            .sub_tasks
            .iter()
            .filter(|t| matches!(t.status, SwarmStatus::Completed))
            .count() as u32;
        let failed = self
            .sub_tasks
            .iter()
            .filter(|t| matches!(t.status, SwarmStatus::Failed(_)))
            .count() as u32;

        AggregatedResult {
            swarm_id: self.meta.id.clone(),
            total_tasks: self.sub_tasks.len() as u32,
            succeeded,
            failed,
            outputs: self
                .sub_tasks
                .iter()
                .filter_map(|t| t.result.clone())
                .collect(),
            summary: None,
        }
    }

    fn shutdown(&mut self) -> Result<(), SwarmError> {
        self.status = SwarmStatus::Failed("主动关闭".into());
        self.bus.publish(SwarmEvent::StatusChanged {
            old_status: "running".into(),
            new_status: "shutdown".into(),
        });
        Ok(())
    }
}

// ── AgentRegistrar ────────────────────────────────────────────────────────────

impl AgentRegistrar for CollaborativeSwarm {
    fn register_agent(&mut self, agent: Arc<dyn Agent>) -> Result<(), AgentError> {
        let id = agent.meta().id.clone();
        self.bus.publish(SwarmEvent::AgentJoined { agent_id: id });
        self.agent_store.register_agent(agent)
    }
    fn unregister_agent(&mut self, id: &str) -> Result<(), AgentError> {
        self.bus.publish(SwarmEvent::AgentLeft {
            agent_id: id.to_string(),
        });
        self.agent_store.unregister_agent(id)
    }
    fn get_agent(&self, id: &str) -> Option<Arc<dyn Agent>> {
        self.agent_store.get_agent(id)
    }
    fn list_agents(&self) -> Vec<AgentMeta> {
        self.agent_store.list_agents()
    }
}

// ── ToolRegistrar ─────────────────────────────────────────────────────────────

impl ToolRegistrar for CollaborativeSwarm {
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

// ── ContextRegistrar ──────────────────────────────────────────────────────────

impl ContextRegistrar for CollaborativeSwarm {
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
