#![allow(dead_code)]
use serde::{Deserialize, Serialize};

/// 感知层可处理的原始输入枚举
///
/// 每个变体对应一类输入来源；`PerceptionProcessor` 实现负责将其转为 `ContextEntry`。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PerceptionInput {
    /// 纯文本（用户消息、LLM 回复等）
    Text {
        content: String,
        /// 可选语言标签（"zh-CN"、"en-US" 等）
        lang: Option<String>,
    },
    /// 图像（base64 编码）
    Image {
        data: String,
        mime_type: String,
        width: Option<u32>,
        height: Option<u32>,
    },
    /// 音频（base64 编码）
    Audio {
        data: String,
        mime_type: String,
        duration_ms: Option<u64>,
    },
    /// 外部 API 返回的 JSON 响应
    ApiResponse {
        source_url: String,
        status_code: u16,
        body: serde_json::Value,
    },
    /// 结构化传感器数据（IoT / 系统监控等）
    Sensor {
        sensor_id: String,
        readings: serde_json::Value,
        unit: Option<String>,
    },
    /// 已结构化的任意 JSON（直接透传）
    Raw(serde_json::Value),
}
