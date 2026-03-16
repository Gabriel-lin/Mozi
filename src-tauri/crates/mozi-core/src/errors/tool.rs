use thiserror::Error;

/// 工具子系统错误
///
/// 按来源分为三段：
/// - **内置工具**（`NotFound` … `Timeout`）：本地 Rust 实现的工具执行过程中产生
/// - **外部工具**（`Rpc` / `Stdio` / `Mcp`）：远程协议通信失败
/// - **适配器**（`Serde` / `Adapter`）：协议格式转换失败
#[derive(Debug, Error, Clone)]
pub enum ToolError {
    // ── 内置工具错误 ──────────────────────────────────────────────────────
    /// 工具 ID 未注册
    #[error("工具未找到: {0}")]
    NotFound(String),

    /// 工具 ID 已存在，禁止重复注册
    #[error("工具已存在: {0}")]
    AlreadyRegistered(String),

    /// 调用参数不符合 JSON Schema
    #[error("参数无效: {0}")]
    InvalidParams(String),

    /// 工具执行逻辑本身抛出错误
    #[error("执行失败: {0}")]
    ExecutionFailed(String),

    /// task_id 不存在或已过期
    #[error("任务不存在: {0}")]
    TaskNotFound(String),

    /// 任务已被主动取消
    #[error("任务已取消: {0}")]
    Cancelled(String),

    /// 任务超过等待时限
    #[error("任务超时: {0}")]
    Timeout(String),

    // ── 外部工具错误 ──────────────────────────────────────────────────────
    /// HTTP JSON-RPC 2.0 调用失败（连接超时、服务端错误等）
    #[error("RPC 错误: {0}")]
    Rpc(String),

    /// 子进程 stdin/stdout 通信失败（读写错误、进程崩溃等）
    #[error("Stdio 错误: {0}")]
    Stdio(String),

    /// MCP 协议错误（握手失败、tools/call 响应异常等）
    #[error("MCP 错误: {0}")]
    Mcp(String),

    // ── 适配器错误 ────────────────────────────────────────────────────────
    /// JSON 序列化/反序列化失败
    #[error("序列化错误: {0}")]
    Serde(String),

    /// 协议格式转换失败（字段缺失、类型不匹配等）
    #[error("适配器错误: {0}")]
    Adapter(String),

    // ── 通用 ──────────────────────────────────────────────────────────────
    #[error("未知工具错误: {0}")]
    Unknown(String),
}

impl ToolError {
    /// 是否属于可重试的错误（网络/超时类）
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::Rpc(_) | Self::Timeout(_) | Self::Stdio(_))
    }

    /// 是否属于协议层错误
    pub fn is_protocol_error(&self) -> bool {
        matches!(self, Self::Rpc(_) | Self::Stdio(_) | Self::Mcp(_))
    }

    /// 是否属于内置工具错误
    pub fn is_buildin_error(&self) -> bool {
        matches!(
            self,
            Self::NotFound(_)
                | Self::AlreadyRegistered(_)
                | Self::InvalidParams(_)
                | Self::ExecutionFailed(_)
                | Self::TaskNotFound(_)
                | Self::Cancelled(_)
                | Self::Timeout(_)
        )
    }

    /// 是否属于适配器错误
    pub fn is_adapter_error(&self) -> bool {
        matches!(self, Self::Serde(_) | Self::Adapter(_))
    }
}

impl From<serde_json::Error> for ToolError {
    fn from(e: serde_json::Error) -> Self {
        Self::Serde(e.to_string())
    }
}
