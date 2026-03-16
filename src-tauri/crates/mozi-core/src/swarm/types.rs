#![allow(dead_code)]
use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ─────────────────────────── Swarm 元数据 ────────────────────────────────────

/// Swarm 协作模式
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwarmMode {
    /// 主从模式：MasterAgent 分解任务 → 分发给 SubAgent → 汇总
    MasterSlave,
    /// 对等协作：多 Agent 通过消息总线共享中间结果，适合并行任务
    Collaborative,
}

/// Swarm 静态元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmMeta {
    /// 全局唯一 ID
    pub id: String,
    /// 可读名称
    pub name: String,
    /// 协作模式
    pub mode: SwarmMode,
    /// 最大 Agent 数量限制（0 = 不限制）
    pub max_agents: u32,
}

// ─────────────────────────── 运行状态 ────────────────────────────────────────

/// Swarm 全局运行状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwarmStatus {
    Idle,
    Running,
    Completed,
    Failed(String),
    PartiallyFailed { succeeded: u32, failed: u32 },
}

// ─────────────────────────── 子任务 ──────────────────────────────────────────

/// 子任务优先级
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for TaskPriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// 子任务分配单元
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubTask {
    /// 子任务全局唯一 ID
    pub task_id: String,
    /// 分配到的 Agent ID
    pub agent_id: String,
    /// 子任务目标描述
    pub goal: String,
    /// 传递给 Agent 的参数
    pub params: HashMap<String, serde_json::Value>,
    /// 优先级
    pub priority: TaskPriority,
    /// 当前执行状态
    pub status: SwarmStatus,
    /// 执行结果（完成后填充）
    pub result: Option<serde_json::Value>,
}

impl SubTask {
    pub fn new(
        task_id: impl Into<String>,
        agent_id: impl Into<String>,
        goal: impl Into<String>,
    ) -> Self {
        Self {
            task_id: task_id.into(),
            agent_id: agent_id.into(),
            goal: goal.into(),
            params: HashMap::new(),
            priority: TaskPriority::Normal,
            status: SwarmStatus::Idle,
            result: None,
        }
    }

    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }
}

// ─────────────────────────── 聚合结果 ────────────────────────────────────────

/// Swarm 任务的最终聚合结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedResult {
    pub swarm_id: String,
    pub total_tasks: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub outputs: Vec<serde_json::Value>,
    pub summary: Option<String>,
}

impl AggregatedResult {
    pub fn success_rate(&self) -> f32 {
        if self.total_tasks == 0 {
            return 0.0;
        }
        self.succeeded as f32 / self.total_tasks as f32
    }
}
