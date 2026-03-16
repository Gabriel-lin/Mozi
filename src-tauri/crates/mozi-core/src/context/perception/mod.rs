#![allow(dead_code, unused_imports)]
//! # 感知层（Perception）
//!
//! 将外部原始输入转换为结构化 `ContextEntry`，写入 `ContextWindow`。
//!
//! ```text
//! perception/
//!  ├── input.rs     ← PerceptionInput（Text / Image / Audio / ApiResponse / Sensor / Raw）
//!  ├── processor.rs ← PerceptionProcessor trait + DefaultPerceptionProcessor
//!  └── pipeline.rs  ← PerceptionPipeline（管道调度 + ingest()）
//! ```

pub mod input;
pub mod pipeline;
pub mod processor;

pub use input::PerceptionInput;
pub use pipeline::PerceptionPipeline;
pub use processor::{DefaultPerceptionProcessor, PerceptionProcessor};
