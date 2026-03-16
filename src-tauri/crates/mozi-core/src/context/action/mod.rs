#![allow(dead_code, unused_imports)]
//! # 行动层（Action）
//!
//! 记录 Agent 在 ReAct 循环中执行的所有可执行动作及其结果。
//!
//! ```text
//! action/
//!  ├── types.rs   ← ActionKind（动作种类）/ ActionOutcome（执行结果）
//!  ├── record.rs  ← ActionRecord（单条记录 + start/complete/fail 生命周期）
//!  └── history.rs ← ActionHistory（记录集合 + 查询）/ ActionSummary（统计摘要）
//! ```

pub mod history;
pub mod record;
pub mod types;

pub use history::{ActionHistory, ActionSummary};
pub use record::ActionRecord;
pub use types::{ActionKind, ActionOutcome};
