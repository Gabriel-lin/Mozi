#![allow(dead_code)]
//! # 任务调度器（Scheduler）
//!
//! 负责将集群目标拆解为 `SubTask` 列表，并按调度策略将任务分配给合适的 Agent。
//!
//! ## 调度策略
//!
//! | 策略            | 适用场景                          |
//! |----------------|----------------------------------|
//! | `RoundRobin`   | 任务量均匀，Agent 能力相同          |
//! | `LoadBalanced` | 动态感知每个 Agent 的当前负载       |
//! | `Priority`     | 优先将高优先级任务分配给低负载 Agent |
//! | `Affinity`     | 任务与特定 Agent 绑定（类型/技能匹配）|

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::agent::AgentMeta;
use crate::errors::SwarmError;

use super::types::{SubTask, TaskPriority};

// ─────────────────────────── 调度策略 ────────────────────────────────────────

/// 任务调度策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleStrategy {
    /// 轮询：按顺序循环分配，不感知负载
    RoundRobin,
    /// 负载均衡：优先分配给当前任务最少的 Agent
    LoadBalanced,
    /// 优先级调度：高优先级任务优先分配给空闲 Agent
    Priority,
    /// 亲和性调度：根据 `affinity_key` 将任务路由到匹配的 Agent
    Affinity { affinity_key: String },
}

// ─────────────────────────── 调度请求 ────────────────────────────────────────

/// 待调度的任务请求
#[derive(Debug, Clone)]
pub struct TaskRequest {
    /// 请求 ID
    pub id: String,
    /// 子任务目标描述
    pub goal: String,
    /// 传递给 Agent 的参数
    pub params: HashMap<String, serde_json::Value>,
    /// 优先级
    pub priority: TaskPriority,
    /// 亲和性标签（`Affinity` 策略使用）
    pub affinity_tag: Option<String>,
}

impl TaskRequest {
    pub fn new(goal: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            goal: goal.into(),
            params: HashMap::new(),
            priority: TaskPriority::Normal,
            affinity_tag: None,
        }
    }

    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_affinity(mut self, tag: impl Into<String>) -> Self {
        self.affinity_tag = Some(tag.into());
        self
    }
}

// ─────────────────────────── Agent 负载快照 ──────────────────────────────────

/// 单个 Agent 的当前负载统计
#[derive(Debug, Clone, Default)]
pub struct AgentLoad {
    pub agent_id: String,
    /// 当前正在执行的子任务数
    pub active_tasks: u32,
    /// 已完成子任务数
    pub completed_tasks: u32,
    /// 是否处于可接受新任务状态
    pub available: bool,
}

// ─────────────────────────── Scheduler ───────────────────────────────────────

/// 任务调度器
///
/// 持有调度策略和 Agent 负载状态，负责将 `TaskRequest` 分配给最合适的 Agent，
/// 返回填充好 `agent_id` 的 `SubTask` 列表。
pub struct Scheduler {
    strategy: ScheduleStrategy,
    /// Agent 负载表（agent_id → load）
    loads: HashMap<String, AgentLoad>,
    /// 轮询指针（RoundRobin 策略使用）
    rr_cursor: usize,
}

impl Scheduler {
    pub fn new(strategy: ScheduleStrategy) -> Self {
        Self {
            strategy,
            loads: HashMap::new(),
            rr_cursor: 0,
        }
    }

    /// 注册 Agent（调度器需要感知可用 Agent 列表）
    pub fn register_agent(&mut self, meta: &AgentMeta) {
        self.loads.insert(
            meta.id.clone(),
            AgentLoad {
                agent_id: meta.id.clone(),
                active_tasks: 0,
                completed_tasks: 0,
                available: true,
            },
        );
    }

    /// 注销 Agent
    pub fn unregister_agent(&mut self, agent_id: &str) {
        self.loads.remove(agent_id);
    }

    /// 将任务请求列表按策略分配给 Agent，返回 SubTask 列表
    pub fn schedule(&mut self, requests: Vec<TaskRequest>) -> Result<Vec<SubTask>, SwarmError> {
        if self.loads.is_empty() {
            return Err(SwarmError::DispatchFailed("无可用 Agent".into()));
        }

        let mut tasks = Vec::new();
        for req in requests {
            let agent_id = self.pick_agent(&req)?;
            if let Some(load) = self.loads.get_mut(&agent_id) {
                load.active_tasks += 1;
            }
            let task = SubTask::new(req.id, &agent_id, req.goal).with_priority(req.priority);
            tasks.push(task);
        }
        Ok(tasks)
    }

    /// 标记任务完成，更新 Agent 负载
    pub fn task_done(&mut self, agent_id: &str) {
        if let Some(load) = self.loads.get_mut(agent_id) {
            load.active_tasks = load.active_tasks.saturating_sub(1);
            load.completed_tasks += 1;
        }
    }

    /// 返回当前所有 Agent 的负载快照
    pub fn load_snapshot(&self) -> Vec<&AgentLoad> {
        self.loads.values().collect()
    }

    // ── 内部调度逻辑 ──────────────────────────────────────────────────────

    fn pick_agent(&mut self, req: &TaskRequest) -> Result<String, SwarmError> {
        let available: Vec<&AgentLoad> = self.loads.values().filter(|l| l.available).collect();

        if available.is_empty() {
            return Err(SwarmError::DispatchFailed("所有 Agent 均不可用".into()));
        }

        let agent_id = match &self.strategy {
            ScheduleStrategy::RoundRobin => {
                let ids: Vec<&str> = available.iter().map(|l| l.agent_id.as_str()).collect();
                let idx = self.rr_cursor % ids.len();
                self.rr_cursor += 1;
                ids[idx].to_string()
            }
            ScheduleStrategy::LoadBalanced | ScheduleStrategy::Priority => available
                .iter()
                .min_by_key(|l| l.active_tasks)
                .map(|l| l.agent_id.clone())
                .unwrap(),
            ScheduleStrategy::Affinity { affinity_key } => {
                // TODO: 匹配 Agent 的能力标签与 affinity_key
                let tag = req.affinity_tag.as_deref().unwrap_or(affinity_key.as_str());
                available
                    .iter()
                    .find(|l| l.agent_id.contains(tag))
                    .map(|l| l.agent_id.clone())
                    .unwrap_or_else(|| available[0].agent_id.clone())
            }
        };

        Ok(agent_id)
    }
}
