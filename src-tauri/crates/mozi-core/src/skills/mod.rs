#![allow(dead_code, unused_imports)]
//! # Skills 子系统
//!
//! Skill（技能）是介于 `Tool`（工具）和 `Agent` 之间的**可复用行为单元**：
//! 可组合多个工具调用，内置执行策略（重试、降级），无需上下文窗口管理。
//!
//! ## 模块结构
//!
//! ```text
//! skills/
//!  ├── types.rs       ← SkillMeta / SkillResult / SkillStatus
//!  ├── traits.rs      ← Skill 核心 trait
//!  ├── registry.rs    ← SkillRegistrar trait（供 Agent 实现）
//!  ├── store.rs       ← SkillStore（SkillRegistrar 标准实现）
//!  │
//!  ├── fetch/         ← 信息获取技能
//!  │    ├── rag.rs    ← RagSkill（向量检索增强）
//!  │    └── search.rs ← WebSearchSkill（实时网络搜索）
//!  │
//!  ├── memory/        ← 记忆技能
//!  │    ├── short_term.rs ← ShortTermMemorySkill（对话摘要压缩）
//!  │    └── long_term.rs  ← LongTermMemorySkill（跨会话知识持久化）
//!  │
//!  ├── policy/        ← 执行策略技能
//!  │    ├── retry.rs    ← RetrySkill（自动重试 + 退避）
//!  │    └── fallback.rs ← FallbackSkill（技能降级链）
//!  │
//!  └── interactive/   ← 交互技能
//!       ├── confirm.rs  ← UserConfirmSkill（高风险操作授权）
//!       └── dialogue.rs ← MultiTurnDialogueSkill（多轮澄清对话）
//! ```
//!
//! ## 注册关系
//!
//! ```text
//! Skill ──(SkillRegistrar)──► SkillStore ──► Agent
//! ```

pub mod fetch;
pub mod interactive;
pub mod memory;
pub mod policy;
pub mod registry;
pub mod store;
pub mod traits;
pub mod types;

// ── 核心类型 ──────────────────────────────────────────────────────────────────
pub use types::{SkillMeta, SkillResult, SkillStatus};

// ── 核心 Trait ────────────────────────────────────────────────────────────────
pub use traits::Skill;

// ── 注册器 ────────────────────────────────────────────────────────────────────
pub use registry::SkillRegistrar;
pub use store::SkillStore;

// ── 信息获取技能 ──────────────────────────────────────────────────────────────
pub use fetch::{RagConfig, RagSkill, SearchEngine, WebSearchConfig, WebSearchSkill};

// ── 记忆技能 ──────────────────────────────────────────────────────────────────
pub use memory::{
    LongTermConfig, LongTermMemorySkill, LongTermOp, ShortTermConfig, ShortTermMemorySkill,
};

// ── 执行策略技能 ──────────────────────────────────────────────────────────────
pub use policy::{BackoffStrategy, FallbackConfig, FallbackSkill, RetryConfig, RetrySkill};

// ── 交互技能 ──────────────────────────────────────────────────────────────────
pub use interactive::{
    ConfirmMode, DialogueTurn, MultiTurnConfig, MultiTurnDialogueSkill, UserConfirmConfig,
    UserConfirmSkill,
};
