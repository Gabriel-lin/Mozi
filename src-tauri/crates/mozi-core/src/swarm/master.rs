#![allow(dead_code)]
//! # MasterSlaveSwarm — 主从协作集群
//!
//! 主从模式下，Swarm 内部有一个逻辑上的 **MasterAgent** 负责：
//!
//! 1. 接收顶层 `goal`
//! 2. 调用 LLM 将其拆解为若干子任务（`SubTask`）
//! 3. 通过 `Scheduler` 将子任务分发给空闲 `SubAgent`
//! 4. 等待所有子任务完成后聚合结果
//!
//! ## 内部结构
//!
//! ```text
//! MasterSlaveSwarm
//!  ├── agent_store   : AgentStore        (impl AgentRegistrar)
//!  ├── tool_store    : ToolStore         (impl ToolRegistrar)
//!  ├── context       : Option<ContextWindow> (impl ContextRegistrar)
//!  ├── scheduler     : Scheduler         (任务分发策略)
//!  ├── bus           : MessageBus        (事件总线)
//!  └── sub_tasks     : Vec<SubTask>      (执行快照)
//! ```

use std::sync::Arc;

use crate::agent::{Agent, AgentMeta, AgentRegistrar, AgentStore};
use crate::context::{ContextRegistrar, ContextWindow};
use crate::errors::{AgentError, ContextError, SwarmError};
use crate::tools::registry::{Tool, ToolCategory, ToolMeta, ToolRegistrar, ToolStore, ToolType};
use crate::tools::ToolError;

use super::coordinator::{MessageBus, SwarmEvent};
use super::scheduler::{ScheduleStrategy, Scheduler, TaskRequest};
use super::traits::Swarm;
use super::types::{AggregatedResult, SubTask, SwarmMeta, SwarmMode, SwarmStatus};

// ─────────────────────────── MasterSlaveSwarm ────────────────────────────────

pub struct MasterSlaveSwarm {
    meta: SwarmMeta,
    status: SwarmStatus,
    agent_store: AgentStore,
    tool_store: ToolStore,
    context: Option<ContextWindow>,
    scheduler: Scheduler,
    bus: MessageBus,
    sub_tasks: Vec<SubTask>,
}

impl MasterSlaveSwarm {
    pub fn new(meta: SwarmMeta, strategy: ScheduleStrategy) -> Self {
        assert_eq!(
            meta.mode,
            SwarmMode::MasterSlave,
            "MasterSlaveSwarm 需要 MasterSlave 模式"
        );
        Self {
            meta,
            status: SwarmStatus::Idle,
            agent_store: AgentStore::new(),
            tool_store: ToolStore::new(),
            context: None,
            scheduler: Scheduler::new(strategy),
            bus: MessageBus::new(),
            sub_tasks: Vec::new(),
        }
    }

    /// 返回消息总线的只读引用（供外部监控使用）
    pub fn bus(&self) -> &MessageBus {
        &self.bus
    }

    /// 返回调度器的负载快照
    pub fn scheduler_loads(&self) -> Vec<&super::scheduler::AgentLoad> {
        self.scheduler.load_snapshot()
    }
}

// ── Swarm trait ───────────────────────────────────────────────────────────────

impl Swarm for MasterSlaveSwarm {
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
        self.sub_tasks.clear();

        // TODO: 调用 MasterAgent / LLM 将 goal 拆解为 TaskRequest 列表
        let requests = vec![TaskRequest::new(format!("子任务: {}", goal))];

        let tasks = self.scheduler.schedule(requests)?;
        let dispatch_id = uuid::Uuid::new_v4().to_string();

        for task in &tasks {
            self.bus.publish(SwarmEvent::TaskDispatched {
                task_id: task.task_id.clone(),
                agent_id: task.agent_id.clone(),
                goal: task.goal.clone(),
            });
        }
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

// ── AgentRegistrar（委托给 agent_store） ──────────────────────────────────────

impl AgentRegistrar for MasterSlaveSwarm {
    fn register_agent(&mut self, agent: Arc<dyn Agent>) -> Result<(), AgentError> {
        let meta = agent.meta().clone();
        self.scheduler.register_agent(&meta);
        self.bus
            .publish(SwarmEvent::AgentJoined { agent_id: meta.id });
        self.agent_store.register_agent(agent)
    }
    fn unregister_agent(&mut self, id: &str) -> Result<(), AgentError> {
        self.scheduler.unregister_agent(id);
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

// ── ToolRegistrar（委托给 tool_store） ────────────────────────────────────────

impl ToolRegistrar for MasterSlaveSwarm {
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

impl ContextRegistrar for MasterSlaveSwarm {
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
