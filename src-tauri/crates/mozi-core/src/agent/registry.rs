#![allow(dead_code)]
use std::collections::HashMap;
use std::sync::Arc;

use crate::errors::AgentError;

use super::traits::Agent;
use super::types::AgentMeta;

// ─────────────────────────── AgentRegistrar Trait ────────────────────────────

/// Agent 注册器 Trait
///
/// 任何可以**持有并调度 Agent 集合**的主体（当前仅 `Swarm`）实现此接口。
///
/// ```
/// Swarm
///  └── AgentStore ──(impl AgentRegistrar)──► [Agent, Agent, …]
/// ```
pub trait AgentRegistrar: Send + Sync {
    /// 注册 Agent（加入调度池）
    ///
    /// 若 ID 已存在则返回 `AgentError::AlreadyRegistered`。
    fn register_agent(&mut self, agent: Arc<dyn Agent>) -> Result<(), AgentError>;

    /// 注销 Agent
    ///
    /// 若 ID 不存在则返回 `AgentError::NotFound`。
    fn unregister_agent(&mut self, id: &str) -> Result<(), AgentError>;

    /// 按 ID 返回 Agent 的 `Arc` 引用（只读）
    ///
    /// 需要可变访问时应在调用方持有 `Arc<Mutex<dyn Agent>>`。
    fn get_agent(&self, id: &str) -> Option<Arc<dyn Agent>>;

    /// 返回所有已注册 Agent 的元数据克隆（按 ID 排序）
    fn list_agents(&self) -> Vec<AgentMeta>;

    /// Agent 是否已注册
    fn has_agent(&self, id: &str) -> bool {
        self.get_agent(id).is_some()
    }

    /// 已注册 Agent 总数
    fn agent_count(&self) -> usize {
        self.list_agents().len()
    }
}

// ─────────────────────────── AgentStore ──────────────────────────────────────

/// `AgentRegistrar` 的标准内存实现
///
/// 以 `HashMap<id, Arc<dyn Agent>>` 作为底层存储；
/// 可作为内部字段被组合进 `Swarm`，通过委托满足 `AgentRegistrar`。
pub struct AgentStore {
    agents: HashMap<String, Arc<dyn Agent>>,
}

impl AgentStore {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
        }
    }

    /// 返回所有 Agent 的 Arc 引用列表（供 Swarm 广播工具/上下文时遍历）
    pub fn all(&self) -> Vec<Arc<dyn Agent>> {
        self.agents.values().cloned().collect()
    }
}

impl Default for AgentStore {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentRegistrar for AgentStore {
    fn register_agent(&mut self, agent: Arc<dyn Agent>) -> Result<(), AgentError> {
        let id = agent.meta().id.clone();
        if self.agents.contains_key(&id) {
            return Err(AgentError::AlreadyRegistered(id));
        }
        self.agents.insert(id, agent);
        Ok(())
    }

    fn unregister_agent(&mut self, id: &str) -> Result<(), AgentError> {
        self.agents
            .remove(id)
            .map(|_| ())
            .ok_or_else(|| AgentError::NotFound(id.to_string()))
    }

    fn get_agent(&self, id: &str) -> Option<Arc<dyn Agent>> {
        self.agents.get(id).cloned()
    }

    fn list_agents(&self) -> Vec<AgentMeta> {
        let mut metas: Vec<AgentMeta> = self.agents.values().map(|a| a.meta().clone()).collect();
        metas.sort_by(|a, b| a.id.cmp(&b.id));
        metas
    }
}
