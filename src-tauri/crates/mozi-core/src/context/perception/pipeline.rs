#![allow(dead_code)]
use crate::context::types::ContextSource;
use crate::context::window::ContextWindow;
use crate::errors::ContextError;

use super::input::PerceptionInput;
use super::processor::{DefaultPerceptionProcessor, PerceptionProcessor};

/// 感知处理管道
///
/// 持有多个 `PerceptionProcessor`，按注册顺序查找第一个 `accepts()` 为真的处理器
/// 执行转换，然后将结果 `ContextEntry` 写入 `ContextWindow`。
///
/// ```text
/// PerceptionPipeline
///   [TextProcessor, ImageProcessor, DefaultPerceptionProcessor]  ← 按优先级排列
///       │
///       └── ingest(input, source, &mut window)
///              ├── 找第一个 accepts() == true 的处理器
///              ├── process() → ContextEntry
///              └── window.push(entry)
/// ```
pub struct PerceptionPipeline {
    processors: Vec<Box<dyn PerceptionProcessor>>,
}

impl PerceptionPipeline {
    /// 创建仅含 `DefaultPerceptionProcessor` 的管道（兜底处理器）
    pub fn new() -> Self {
        Self {
            processors: vec![Box::new(DefaultPerceptionProcessor)],
        }
    }

    // ── 处理器注册 ────────────────────────────────────────────────────────

    /// 在管道**头部**插入高优先级处理器
    pub fn prepend(&mut self, processor: Box<dyn PerceptionProcessor>) {
        self.processors.insert(0, processor);
    }

    /// 在管道**尾部**追加低优先级处理器
    pub fn append(&mut self, processor: Box<dyn PerceptionProcessor>) {
        self.processors.push(processor);
    }

    /// 已注册处理器数量
    pub fn processor_count(&self) -> usize {
        self.processors.len()
    }

    // ── 核心方法 ──────────────────────────────────────────────────────────

    /// 处理输入并写入上下文窗口
    ///
    /// 找不到合适处理器时返回 `ContextError::EntryInvalid`。
    pub fn ingest(
        &self,
        input: PerceptionInput,
        source: ContextSource,
        window: &mut ContextWindow,
    ) -> Result<(), ContextError> {
        let processor = self
            .processors
            .iter()
            .find(|p| p.accepts(&input))
            .ok_or_else(|| ContextError::EntryInvalid("无匹配的感知处理器".into()))?;
        let entry = processor.process(input, source)?;
        window.push(entry);
        Ok(())
    }
}

impl Default for PerceptionPipeline {
    fn default() -> Self {
        Self::new()
    }
}
