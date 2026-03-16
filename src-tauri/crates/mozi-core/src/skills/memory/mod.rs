#![allow(dead_code, unused_imports)]
//! # 记忆技能（Memory）
//!
//! 管理 Agent 的短期上下文压缩和长期知识持久化。
//!
//! ```text
//! memory/
//!  ├── short_term.rs ← ShortTermMemorySkill（对话摘要压缩，防止 token 溢出）
//!  └── long_term.rs  ← LongTermMemorySkill（跨会话持久化与语义召回）
//! ```

pub mod long_term;
pub mod short_term;

pub use long_term::{LongTermConfig, LongTermMemorySkill, LongTermOp};
pub use short_term::{ShortTermConfig, ShortTermMemorySkill};
