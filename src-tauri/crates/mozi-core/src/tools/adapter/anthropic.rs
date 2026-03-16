#![allow(dead_code, unused_imports)]
/// Anthropic Claude Tool Use 协议适配器
///
/// 协议格式（请求，来自 assistant message content block）：
/// ```json
/// {
///   "type": "tool_use",
///   "id": "toolu_01A09q90qw90lq917835lq9",
///   "name": "tool_id",
///   "input": { "key": "value" }
/// }
/// ```
///
/// 协议格式（响应，user message content block）：
/// ```json
/// {
///   "type": "tool_result",
///   "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
///   "content": "...",
///   "is_error": false
/// }
/// ```
///
/// 工具定义格式：
/// ```json
/// { "name": "...", "description": "...", "input_schema": { ... } }
/// ```
use std::collections::HashMap;

use serde_json::Value;

use crate::tools::error::ToolError;
use crate::tools::registry::ToolMeta;

use super::{ProtocolFormat, ToolAdapter, ToolCallRequest, ToolCallResponse};

pub struct AnthropicAdapter;

impl ToolAdapter for AnthropicAdapter {
    fn protocol(&self) -> ProtocolFormat {
        ProtocolFormat::Anthropic
    }

    fn decode_request(&self, raw: &Value) -> Result<ToolCallRequest, ToolError> {
        let call_id = raw["id"].as_str().map(String::from);

        let tool_id = raw["name"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 name 字段".into()))?
            .to_string();

        // input 字段直接是 JSON 对象，无需二次解析
        let params = raw
            .get("input")
            .cloned()
            .unwrap_or(Value::Object(serde_json::Map::new()));

        Ok(ToolCallRequest {
            tool_id,
            params,
            call_id,
            metadata: HashMap::new(),
        })
    }

    fn encode_response(&self, resp: &ToolCallResponse) -> Result<Value, ToolError> {
        Ok(serde_json::json!({
            "type": "tool_result",
            "tool_use_id": resp.call_id,
            "content": resp.output.to_string(),
            "is_error": resp.error.is_some(),
        }))
    }

    fn encode_tool_def(&self, meta: &ToolMeta) -> Result<Value, ToolError> {
        Ok(serde_json::json!({
            "name": meta.id,
            "description": meta.description,
            "input_schema": meta.input_schema,
        }))
    }
}
