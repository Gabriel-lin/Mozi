#![allow(dead_code, unused_imports)]
//! # 交互技能（Interactive）
//!
//! 管理 Agent 与用户之间的显式交互流程。
//!
//! ```text
//! interactive/
//!  ├── confirm.rs  ← UserConfirmSkill（高风险操作前请求用户授权）
//!  └── dialogue.rs ← MultiTurnDialogueSkill（多轮澄清对话）
//! ```

pub mod confirm;
pub mod dialogue;

pub use confirm::{ConfirmMode, UserConfirmConfig, UserConfirmSkill};
pub use dialogue::{DialogueTurn, MultiTurnConfig, MultiTurnDialogueSkill};
