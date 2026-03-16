use thiserror::Error;

use super::agent::AgentError;

/// Swarm 子系统错误
#[derive(Debug, Error, Clone)]
pub enum SwarmError {
    // ── Agent 管理 ────────────────────────────────────────────────────────
    /// Agent ID 未在 Swarm 中注册
    #[error("Agent 未找到: {0}")]
    AgentNotFound(String),

    /// Agent ID 已存在，禁止重复注册
    #[error("Agent 已存在: {0}")]
    AgentAlreadyRegistered(String),

    // ── 任务调度 ──────────────────────────────────────────────────────────
    /// 任务分发失败（无可用 Agent、调度策略拒绝等）
    #[error("任务分发失败: {0}")]
    DispatchFailed(String),

    /// 某个子 Agent 执行失败（携带原始 AgentError）
    #[error("子 Agent [{agent_id}] 失败: {reason}")]
    AgentFailed { agent_id: String, reason: String },

    /// 部分子任务失败（map-reduce 场景）
    #[error("部分任务失败：成功 {succeeded} 个，失败 {failed} 个")]
    PartialFailure { succeeded: u32, failed: u32 },

    // ── 生命周期 ──────────────────────────────────────────────────────────
    /// 关闭集群时某个 Agent 未能正常退出
    #[error("关闭失败: {0}")]
    ShutdownFailed(String),

    // ── 通用 ──────────────────────────────────────────────────────────────
    #[error("未知 Swarm 错误: {0}")]
    Unknown(String),
}

impl From<AgentError> for SwarmError {
    fn from(e: AgentError) -> Self {
        Self::AgentFailed {
            agent_id: String::from("<unknown>"),
            reason: e.to_string(),
        }
    }
}
