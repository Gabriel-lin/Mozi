#![allow(dead_code)]
//! # TaskAgent
//!
//! 通用任务规划与执行代理，融合以下策略：
//!
//! - **CoT（Chain-of-Thought）**：逐步推理，生成 Thought
//! - **ReAct**：Reason + Act 循环，直到得到最终答案或达到 `max_steps`
//! - **RAG**：（规划中）检索增强，将外部知识注入 ContextWindow
//! - **RL-online**：（规划中）在线强化学习，基于执行反馈更新策略
//!
//! ## 内部结构
//!
//! ```text
//! TaskAgent
//!  ├── tool_store    : ToolStore        (impl ToolRegistrar)
//!  ├── skill_store   : SkillStore       (impl SkillRegistrar)
//!  ├── context       : Option<ContextWindow> (impl ContextRegistrar)
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

// ─────────────────────────── TaskAgent ───────────────────────────────────────

pub struct TaskAgent {
    meta: AgentMeta,
    status: AgentStatus,
    tool_store: ToolStore,
    skill_store: SkillStore,
    context: Option<ContextWindow>,
    react: ReActEngine,
}

impl TaskAgent {
    pub fn new(meta: AgentMeta) -> Self {
        let max_steps = meta.max_steps;
        Self {
            meta,
            status: AgentStatus::Idle,
            tool_store: ToolStore::new(),
            skill_store: SkillStore::new(),
            context: None,
            react: ReActEngine::new(max_steps),
        }
    }
}

// ── Agent trait ───────────────────────────────────────────────────────────────

impl Agent for TaskAgent {
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
            return Err(AgentError::GoalInvalid("目标不能为空".into()));
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
        // TODO: 调用 LLM 产生 Thought，解析 Action，执行工具并收集 Observation
        let step = AgentStep {
            step_id: self.react.current_step() + 1,
            thought: Some("（TaskAgent 占位推理）".into()),
            action: None,
            action_input: None,
            observation: None,
        };
        self.status = AgentStatus::Executing;
        self.react.record_step(step.clone())?;
        Ok(step)
    }

    fn stop(&mut self) -> Result<(), AgentError> {
        self.status = AgentStatus::Failed("手动停止".into());
        Ok(())
    }

    fn history(&self) -> &[AgentStep] {
        self.react.steps()
    }
}

// ── ToolRegistrar（委托给 tool_store） ────────────────────────────────────────

impl ToolRegistrar for TaskAgent {
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

// ── SkillRegistrar（委托给 skill_store） ──────────────────────────────────────

impl SkillRegistrar for TaskAgent {
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

impl ContextRegistrar for TaskAgent {
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
