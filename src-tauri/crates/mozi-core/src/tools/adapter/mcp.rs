#![allow(dead_code, unused_imports)]
/// Model Context Protocol（MCP）适配器
///
/// 遵循 MCP 规范 2024-11-05。
///
/// 协议格式（tools/call 请求 params）：
/// ```json
/// { "name": "tool_id", "arguments": { "key": "value" } }
/// ```
///
/// 协议格式（tools/call 响应 result）：
/// ```json
/// {
///   "content": [{ "type": "text", "text": "..." }],
///   "isError": false
/// }
/// ```
///
/// 工具定义格式（tools/list 响应中的单个条目）：
/// ```json
/// { "name": "...", "description": "...", "inputSchema": { ... } }
/// ```
use std::collections::HashMap;

use serde_json::Value;

use crate::tools::error::ToolError;
use crate::tools::registry::ToolMeta;

use super::{ProtocolFormat, ToolAdapter, ToolCallRequest, ToolCallResponse};

pub struct McpAdapter;

impl ToolAdapter for McpAdapter {
    fn protocol(&self) -> ProtocolFormat {
        ProtocolFormat::Mcp
    }

    fn decode_request(&self, raw: &Value) -> Result<ToolCallRequest, ToolError> {
        let tool_id = raw["name"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 name 字段".into()))?
            .to_string();

        // arguments 直接是 JSON 对象
        let params = raw
            .get("arguments")
            .cloned()
            .unwrap_or(Value::Object(serde_json::Map::new()));

        Ok(ToolCallRequest {
            tool_id,
            params,
            call_id: None, // MCP 协议不在 params 层携带 call_id，由外层 JSON-RPC id 追踪
            metadata: HashMap::new(),
        })
    }

    fn encode_response(&self, resp: &ToolCallResponse) -> Result<Value, ToolError> {
        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": resp.output.to_string(),
            }],
            "isError": resp.error.is_some(),
        }))
    }

    fn encode_tool_def(&self, meta: &ToolMeta) -> Result<Value, ToolError> {
        Ok(serde_json::json!({
            "name": meta.id,
            "description": meta.description,
            "inputSchema": meta.input_schema,
        }))
    }
}
