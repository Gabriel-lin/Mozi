#![allow(dead_code, unused_imports)]
/// OpenAI Function Calling 协议适配器
///
/// 协议格式（请求）：
/// ```json
/// {
///   "id": "call_abc123",
///   "type": "function",
///   "function": {
///     "name": "tool_id",
///     "arguments": "{\"key\": \"value\"}"
///   }
/// }
/// ```
///
/// 协议格式（响应 message）：
/// ```json
/// { "role": "tool", "tool_call_id": "call_abc123", "content": "..." }
/// ```
///
/// 工具定义格式：
/// ```json
/// {
///   "type": "function",
///   "function": { "name": "...", "description": "...", "parameters": { ... } }
/// }
/// ```
use std::collections::HashMap;

use serde_json::Value;

use crate::tools::error::ToolError;
use crate::tools::registry::ToolMeta;

use super::{ProtocolFormat, ToolAdapter, ToolCallRequest, ToolCallResponse};

pub struct OpenAIAdapter;

impl ToolAdapter for OpenAIAdapter {
    fn protocol(&self) -> ProtocolFormat {
        ProtocolFormat::OpenAI
    }

    fn decode_request(&self, raw: &Value) -> Result<ToolCallRequest, ToolError> {
        let call_id = raw["id"].as_str().map(String::from);

        let func = raw
            .get("function")
            .ok_or_else(|| ToolError::InvalidParams("缺少 function 字段".into()))?;

        let tool_id = func["name"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 function.name".into()))?
            .to_string();

        // arguments 是 JSON 字符串，需要二次解析
        let args_str = func["arguments"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 function.arguments".into()))?;
        let params: Value = serde_json::from_str(args_str)?;

        Ok(ToolCallRequest {
            tool_id,
            params,
            call_id,
            metadata: HashMap::new(),
        })
    }

    fn encode_response(&self, resp: &ToolCallResponse) -> Result<Value, ToolError> {
        Ok(serde_json::json!({
            "role": "tool",
            "tool_call_id": resp.call_id,
            "content": resp.output.to_string(),
        }))
    }

    fn encode_tool_def(&self, meta: &ToolMeta) -> Result<Value, ToolError> {
        Ok(serde_json::json!({
            "type": "function",
            "function": {
                "name": meta.id,
                "description": meta.description,
                "parameters": meta.input_schema,
            }
        }))
    }
}
