use thiserror::Error;

use super::tool::ToolError;

/// Agent 子系统错误
#[derive(Debug, Error, Clone)]
pub enum AgentError {
    // ── 注册 ──────────────────────────────────────────────────────────────
    /// Agent ID 未注册
    #[error("Agent 未找到: {0}")]
    NotFound(String),

    /// Agent ID 已存在，禁止重复注册
    #[error("Agent 已存在: {0}")]
    AlreadyRegistered(String),

    // ── 执行 ──────────────────────────────────────────────────────────────
    /// Agent 已在运行中，拒绝重复提交任务
    #[error("Agent 正在运行: {0}")]
    AlreadyRunning(String),

    /// 目标（goal）不合法或为空
    #[error("目标无效: {0}")]
    GoalInvalid(String),

    /// 单步（step）执行失败
    #[error("执行步骤失败: {0}")]
    StepFailed(String),

    /// 超过最大步数限制
    #[error("超过最大步数: {0}")]
    MaxStepsExceeded(String),

    /// Agent 内部工具调用失败（携带原始 ToolError）
    #[error("工具调用失败: {0}")]
    ToolCallFailed(#[from] ToolError),

    /// Agent 被主动停止
    #[error("Agent 已停止: {0}")]
    Stopped(String),

    // ── 通用 ──────────────────────────────────────────────────────────────
    #[error("未知 Agent 错误: {0}")]
    Unknown(String),
}
