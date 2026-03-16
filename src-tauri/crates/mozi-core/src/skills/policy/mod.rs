#![allow(dead_code, unused_imports)]
//! # 执行策略技能（Policy）
//!
//! 为技能调用提供可靠性保障策略，与 `context::policy`（动作选择策略）正交。
//!
//! ```text
//! policy/
//!  ├── retry.rs    ← RetrySkill（固定/指数退避自动重试）
//!  └── fallback.rs ← FallbackSkill（主技能失败后按链降级）
//! ```

pub mod fallback;
pub mod retry;

pub use fallback::{FallbackConfig, FallbackSkill};
pub use retry::{BackoffStrategy, RetryConfig, RetrySkill};
