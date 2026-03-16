#![allow(dead_code)]
//! # 集群协调层（Coordinator）
//!
//! 负责 Swarm 内部各 Agent 之间的消息传递、状态广播和事件分发。
//!
//! ## 核心概念
//!
//! ```text
//! Agent A ──publish──► MessageBus ──subscribe──► Agent B
//!                           │
//!                           └──► EventLog（审计 / 回溯）
//! ```
//!
//! ## 使用方式
//!
//! - **MasterSlave 模式**：Master 通过 `broadcast_task()` 下发子任务，
//!   SubAgent 通过 `report_result()` 上报结果。
//! - **Collaborative 模式**：所有 Agent 平等地 `publish()` 消息，
//!   订阅方通过 `drain()` 获取自己关注的消息。

use std::collections::{HashMap, VecDeque};

use serde::{Deserialize, Serialize};

// ─────────────────────────── 集群事件 ────────────────────────────────────────

/// Swarm 内部事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SwarmEvent {
    /// 新子任务已分发
    TaskDispatched {
        task_id: String,
        agent_id: String,
        goal: String,
    },
    /// 子任务已完成
    TaskCompleted {
        task_id: String,
        agent_id: String,
        result: serde_json::Value,
    },
    /// 子任务失败
    TaskFailed {
        task_id: String,
        agent_id: String,
        reason: String,
    },
    /// Agent 间传递的自定义消息（对等协作）
    AgentMessage {
        from: String,
        to: Option<String>,
        payload: serde_json::Value,
    },
    /// 集群状态变更通知
    StatusChanged {
        old_status: String,
        new_status: String,
    },
    /// Agent 加入集群
    AgentJoined { agent_id: String },
    /// Agent 离开集群
    AgentLeft { agent_id: String },
}

// ─────────────────────────── 消息总线 ────────────────────────────────────────

/// Swarm 消息总线
///
/// 简单的内存事件队列：
/// - `publish()`：将事件推送到全局队列
/// - `drain()`：取出所有待处理事件（清空队列）
/// - `drain_for()`：取出发给特定 Agent 的消息
/// - `history()`：返回所有历史事件（用于审计 / 回溯）
pub struct MessageBus {
    /// 待处理事件队列
    pending: VecDeque<SwarmEvent>,
    /// 历史事件记录（不自动清除）
    history: Vec<SwarmEvent>,
    /// 每个 Agent 的专属消息队列（from `AgentMessage` 事件）
    mailboxes: HashMap<String, VecDeque<serde_json::Value>>,
}

impl MessageBus {
    pub fn new() -> Self {
        Self {
            pending: VecDeque::new(),
            history: Vec::new(),
            mailboxes: HashMap::new(),
        }
    }

    /// 发布事件（自动路由到对应邮箱）
    pub fn publish(&mut self, event: SwarmEvent) {
        if let SwarmEvent::AgentMessage {
            ref to,
            ref payload,
            ..
        } = event
        {
            if let Some(agent_id) = to {
                self.mailboxes
                    .entry(agent_id.clone())
                    .or_default()
                    .push_back(payload.clone());
            }
        }
        self.history.push(event.clone());
        self.pending.push_back(event);
    }

    /// 取出所有待处理事件（清空 pending 队列）
    pub fn drain(&mut self) -> Vec<SwarmEvent> {
        self.pending.drain(..).collect()
    }

    /// 取出发给特定 Agent 的所有消息
    pub fn drain_mailbox(&mut self, agent_id: &str) -> Vec<serde_json::Value> {
        self.mailboxes
            .get_mut(agent_id)
            .map(|q| q.drain(..).collect())
            .unwrap_or_default()
    }

    /// 返回全量历史事件（只读）
    pub fn history(&self) -> &[SwarmEvent] {
        &self.history
    }

    /// 按事件类型筛选历史
    pub fn history_by_task(&self, task_id: &str) -> Vec<&SwarmEvent> {
        self.history
            .iter()
            .filter(|e| match e {
                SwarmEvent::TaskDispatched { task_id: t, .. }
                | SwarmEvent::TaskCompleted { task_id: t, .. }
                | SwarmEvent::TaskFailed { task_id: t, .. } => t == task_id,
                _ => false,
            })
            .collect()
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    pub fn clear_history(&mut self) {
        self.history.clear();
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new()
    }
}
