#![allow(dead_code, unused_imports)]
/// 工具适配器模块
///
/// 提供统一的协议转换层，将不同来源的工具调用格式转换为内部
/// `ToolContext` / `ToolResult`，或将内部格式序列化为对外协议所需的结构。
///
/// 子模块：
/// - `openai`     ← OpenAI Function Calling 适配器
/// - `anthropic`  ← Anthropic Claude Tool Use 适配器
/// - `mcp`        ← Model Context Protocol 适配器
pub mod anthropic;
pub mod mcp;
pub mod openai;

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::tools::error::ToolError;
use crate::tools::registry::{ToolContext, ToolMeta, ToolResult, ToolStatus};

// ─────────────────────────── 协议格式枚举 ────────────────────────────────

/// 工具调用所使用的外部协议格式
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProtocolFormat {
    /// OpenAI Function Calling 格式
    OpenAI,
    /// Anthropic Claude Tool Use 格式
    Anthropic,
    /// Model Context Protocol（MCP）格式
    Mcp,
    /// 内部原生格式（直接使用 ToolContext）
    Native,
}

// ─────────────────────────── 通用调用请求 / 响应 ─────────────────────────

/// 标准化的工具调用请求（适配器输入）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallRequest {
    /// 工具 ID
    pub tool_id: String,
    /// 调用参数（已解析为 JSON）
    pub params: Value,
    /// 调用 ID（由调用方生成，用于关联响应）
    pub call_id: Option<String>,
    /// 附加元数据
    pub metadata: HashMap<String, Value>,
}

/// 标准化的工具调用响应（适配器输出）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResponse {
    /// 对应的调用 ID
    pub call_id: Option<String>,
    /// 任务 ID（异步模式）
    pub task_id: String,
    /// 执行结果
    pub output: Value,
    /// 最终状态
    pub status: ToolStatus,
    /// 错误信息（状态为 Failed 时填充）
    pub error: Option<String>,
    /// 执行耗时（毫秒）
    pub elapsed_ms: u64,
}

impl ToolCallResponse {
    /// 从 `ToolResult` 构建标准响应
    pub fn from_result(result: ToolResult, call_id: Option<String>) -> Self {
        let error = if let ToolStatus::Failed(ref msg) = result.status {
            Some(msg.clone())
        } else {
            None
        };
        Self {
            call_id,
            task_id: result.task_id,
            output: result.output,
            status: result.status,
            error,
            elapsed_ms: result.elapsed_ms,
        }
    }

    /// 构建错误响应
    pub fn from_error(err: ToolError, call_id: Option<String>) -> Self {
        Self {
            call_id,
            task_id: String::new(),
            output: Value::Null,
            status: ToolStatus::Failed(err.to_string()),
            error: Some(err.to_string()),
            elapsed_ms: 0,
        }
    }
}

// ─────────────────────────── ToolAdapter Trait ───────────────────────────

/// 工具适配器 Trait
///
/// 实现此 Trait 可以将任意外部协议格式与内部标准格式互转。
/// 每个子模块提供一个具体实现（OpenAI / Anthropic / MCP）。
pub trait ToolAdapter: Send + Sync {
    /// 适配器支持的协议格式标识
    fn protocol(&self) -> ProtocolFormat;

    /// 将外部协议的原始载荷解码为标准 `ToolCallRequest`
    fn decode_request(&self, raw: &Value) -> Result<ToolCallRequest, ToolError>;

    /// 将标准 `ToolCallResponse` 编码为外部协议所需格式
    fn encode_response(&self, resp: &ToolCallResponse) -> Result<Value, ToolError>;

    /// 将 `ToolMeta` 编码为外部协议的工具定义格式
    /// （用于向 LLM 或远程服务声明可用工具列表）
    fn encode_tool_def(&self, meta: &ToolMeta) -> Result<Value, ToolError>;
}

// ─────────────────────────── 辅助转换 ────────────────────────────────────

/// 将 `ToolCallRequest` 转换为 `ToolContext`，注入调用方信息
pub fn request_to_context(req: ToolCallRequest, agent_id: &str, session_id: &str) -> ToolContext {
    ToolContext {
        agent_id: agent_id.to_string(),
        session_id: session_id.to_string(),
        params: req.params,
        metadata: req.metadata,
    }
}

// ─────────────────────────── 便捷 re-export ──────────────────────────────

pub use anthropic::AnthropicAdapter;
pub use mcp::McpAdapter;
pub use openai::OpenAIAdapter;
