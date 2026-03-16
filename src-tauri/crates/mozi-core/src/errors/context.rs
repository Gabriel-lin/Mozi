use thiserror::Error;

use super::tool::ToolError;

/// Context 子系统错误
#[derive(Debug, Error, Clone)]
pub enum ContextError {
    // ── 上下文窗口 ────────────────────────────────────────────────────────
    /// 尚未绑定上下文窗口，操作无法进行
    #[error("上下文未绑定")]
    NotAttached,

    /// 已绑定上下文窗口，禁止重复绑定
    #[error("上下文已绑定")]
    AlreadyAttached,

    /// 上下文条目数据不合法
    #[error("条目无效: {0}")]
    EntryInvalid(String),

    // ── 工具注册（context 级工具） ────────────────────────────────────────
    /// 在 ContextWindow 上注册/调用工具失败
    #[error("上下文工具错误: {0}")]
    ToolError(#[from] ToolError),

    // ── 通用 ──────────────────────────────────────────────────────────────
    #[error("未知上下文错误: {0}")]
    Unknown(String),
}
