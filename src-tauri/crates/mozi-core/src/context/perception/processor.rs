#![allow(dead_code)]
use crate::context::types::{ContextEntry, ContextSource};
use crate::errors::ContextError;

use super::input::PerceptionInput;

// ─────────────────────────── PerceptionProcessor Trait ───────────────────────

/// 感知处理器 Trait
///
/// 实现此接口以接入新的输入类型（图像、音频、传感器等）；
/// 注册到 `PerceptionPipeline` 后即可自动参与输入分发。
pub trait PerceptionProcessor: Send + Sync {
    /// 处理器标识名（用于日志 / 调试）
    fn name(&self) -> &str;

    /// 是否支持处理该输入（`pipeline` 据此做路由）
    fn accepts(&self, input: &PerceptionInput) -> bool;

    /// 将原始输入转换为结构化 `ContextEntry`
    fn process(
        &self,
        input: PerceptionInput,
        source: ContextSource,
    ) -> Result<ContextEntry, ContextError>;
}

// ─────────────────────────── DefaultPerceptionProcessor ──────────────────────

/// 默认感知处理器：接受**所有**输入类型并直接序列化为 JSON
///
/// 作为 `PerceptionPipeline` 的兜底处理器，保证任何输入都能被处理。
pub struct DefaultPerceptionProcessor;

impl PerceptionProcessor for DefaultPerceptionProcessor {
    fn name(&self) -> &str {
        "default"
    }

    fn accepts(&self, _input: &PerceptionInput) -> bool {
        true
    }

    fn process(
        &self,
        input: PerceptionInput,
        source: ContextSource,
    ) -> Result<ContextEntry, ContextError> {
        let content =
            serde_json::to_value(&input).map_err(|e| ContextError::EntryInvalid(e.to_string()))?;
        Ok(ContextEntry::new(source, content))
    }
}
