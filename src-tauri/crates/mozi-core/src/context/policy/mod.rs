#![allow(dead_code, unused_imports)]
//! # 策略层（Policy）
//!
//! 根据当前 `ContextWindow` 内容和可用动作候选集，选择最优行动序列。
//!
//! ```text
//! policy/
//!  ├── types.rs  ← PolicyKind（策略类型标识）/ PolicyDecision（决策结果）
//!  ├── traits.rs ← Policy trait（责任链接口）
//!  ├── rule.rs   ← RulePolicy + PolicyRule（规则驱动策略）
//!  └── engine.rs ← PolicyEngine（策略责任链调度器）
//! ```

pub mod engine;
pub mod rule;
pub mod traits;
pub mod types;

pub use engine::PolicyEngine;
pub use rule::{PolicyRule, RulePolicy};
pub use traits::Policy;
pub use types::{PolicyDecision, PolicyKind};
