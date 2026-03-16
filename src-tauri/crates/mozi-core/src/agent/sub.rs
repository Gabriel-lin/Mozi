#![allow(dead_code)]
//! # SubAgent
//!
//! 被 `Swarm`（主从模式）或 `WorkflowAgent`（DAG 节点）动态调度的子代理。
//!
//! ## 与 TaskAgent 的区别
//!
//! | 维度         | TaskAgent                       | SubAgent                          |
//! |-------------|--------------------------------|-----------------------------------|
//! | 任务来源     | 用户直接提交                     | 由 Master/Workflow 分派            |
//! | 目标粒度     | 顶层宏目标                       | 子任务（原子或中等粒度）             |
//! | 上下文       | 自维护                           | 继承 Swarm 共享上下文               |
//! | 结果去向     | 直接返回用户                      | 上报给 Master，聚合后返回            |
//!
//! ## 内部结构
//!
//! ```text
//! SubAgent
//!  ├── parent_id     : String           (所属 Swarm/Master 的 ID)
//!  ├── tool_store    : ToolStore
//!  ├── skill_store   : SkillStore
//!  ├── context       : Option<ContextWindow>
//!  └── react_engine  : ReActEngine
//! ```

use std::collections::HashMap;
use std::sync::Arc;

use crate::context::{ContextRegistrar, ContextWindow};
use crate::errors::{AgentError, ContextError, SkillsError};
use crate::skills::{Skill, SkillMeta, SkillRegistrar, SkillStore};
use crate::tools::registry::{Tool, ToolCategory, ToolMeta, ToolRegistrar, ToolStore, ToolType};
use crate::tools::ToolError;

use super::react::ReActEngine;
use super::traits::Agent;
use super::types::{AgentMeta, AgentStatus, AgentStep};

// ─────────────────────────── SubAgent ────────────────────────────────────────

pub struct SubAgent {
    meta: AgentMeta,
    /// 派遣本 SubAgent 的上级 ID（Swarm ID 或 WorkflowAgent ID）
    parent_id: String,
    status: AgentStatus,
    tool_store: ToolStore,
    skill_store: SkillStore,
    context: Option<ContextWindow>,
    react: ReActEngine,
}

impl SubAgent {
    pub fn new(meta: AgentMeta, parent_id: impl Into<String>) -> Self {
        let max_steps = meta.max_steps;
        Self {
            meta,
            parent_id: parent_id.into(),
            status: AgentStatus::Idle,
            tool_store: ToolStore::new(),
            skill_store: SkillStore::new(),
            context: None,
            react: ReActEngine::new(max_steps),
        }
    }

    /// 返回派遣方 ID（供 Swarm/Master 识别归属）
    pub fn parent_id(&self) -> &str {
        &self.parent_id
    }
}

// ── Agent trait ───────────────────────────────────────────────────────────────

impl Agent for SubAgent {
    fn meta(&self) -> &AgentMeta {
        &self.meta
    }

    fn status(&self) -> AgentStatus {
        self.status.clone()
    }

    fn run(
        &mut self,
        goal: &str,
        _params: HashMap<String, serde_json::Value>,
    ) -> Result<String, AgentError> {
        if !matches!(
            self.status,
            AgentStatus::Idle | AgentStatus::Completed | AgentStatus::Failed(_)
        ) {
            return Err(AgentError::AlreadyRunning(self.meta.id.clone()));
        }
        if goal.trim().is_empty() {
            return Err(AgentError::GoalInvalid("子任务目标不能为空".into()));
        }
        self.react.reset();
        self.status = AgentStatus::Planning;
        let run_id = uuid::Uuid::new_v4().to_string();
        Ok(run_id)
    }

    fn step(&mut self) -> Result<AgentStep, AgentError> {
        if self.react.is_done() {
            return Err(AgentError::Stopped(self.meta.id.clone()));
        }
        // TODO: 子代理推理 + 工具调用
        let step = AgentStep {
            step_id: self.react.current_step() + 1,
            thought: Some("（SubAgent 占位推理）".into()),
            action: None,
            action_input: None,
            observation: None,
        };
        self.status = AgentStatus::Executing;
        self.react.record_step(step.clone())?;
        Ok(step)
    }

    fn stop(&mut self) -> Result<(), AgentError> {
        self.status = AgentStatus::Failed("被上级终止".into());
        Ok(())
    }

    fn history(&self) -> &[AgentStep] {
        self.react.steps()
    }
}

// ── ToolRegistrar ─────────────────────────────────────────────────────────────

impl ToolRegistrar for SubAgent {
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

impl SkillRegistrar for SubAgent {
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

impl ContextRegistrar for SubAgent {
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
