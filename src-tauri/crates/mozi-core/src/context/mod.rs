#![allow(dead_code, unused_imports)]
//! # Context 子系统
//!
//! ## 模块结构
//!
//! ```text
//! context/
//!  ├── types.rs           ← ContextSource / ContextEntry
//!  ├── window.rs          ← ContextWindow（有界滑动窗口 + ToolRegistrar 委托）
//!  ├── registry.rs        ← ContextRegistrar trait
//!  ├── perception/
//!  │    ├── input.rs      ← PerceptionInput（输入枚举）
//!  │    ├── processor.rs  ← PerceptionProcessor trait + Default 实现
//!  │    └── pipeline.rs   ← PerceptionPipeline（管道调度）
//!  ├── action/
//!  │    ├── types.rs      ← ActionKind / ActionOutcome
//!  │    ├── record.rs     ← ActionRecord（单条记录 + 生命周期）
//!  │    └── history.rs    ← ActionHistory / ActionSummary
//!  └── policy/
//!       ├── types.rs      ← PolicyKind / PolicyDecision
//!       ├── traits.rs     ← Policy trait
//!       ├── rule.rs       ← RulePolicy + PolicyRule
//!       └── engine.rs     ← PolicyEngine（责任链调度器）
//! ```
//!
//! ## 三层数据流
//!
//! ```text
//!                     外部输入
//!                        │
//!                        ▼
//!              ┌──────────────────────┐
//!              │  perception/         │  PerceptionInput ──► ContextEntry
//!              └──────────┬───────────┘
//!                         │ push
//!                         ▼
//!              ┌──────────────────────┐
//!              │  window.rs           │  ContextWindow（有界滑动窗口）
//!              └──────────┬───────────┘
//!                         │ read
//!                         ▼
//!              ┌──────────────────────┐
//!              │  policy/             │  PolicyEngine ──► PolicyDecision
//!              └──────────┬───────────┘
//!                         │ selected action
//!                         ▼
//!              ┌──────────────────────┐
//!              │  action/             │  ActionHistory（记录执行结果）
//!              └──────────────────────┘
//! ```
//!
//! ## 注册关系
//!
//! ```text
//! ContextWindow ──(ToolRegistrar)──► ToolStore（context 级工具）
//! Agent/Swarm ──(ContextRegistrar)──► ContextWindow
//! ```

pub mod action;
pub mod perception;
pub mod policy;
pub mod registry;
pub mod types;
pub mod window;

// ── 核心数据类型 ──────────────────────────────────────────────────────────────
pub use types::{ContextEntry, ContextSource};

// ── 上下文窗口 ────────────────────────────────────────────────────────────────
pub use window::ContextWindow;

// ── 注册器 Trait ──────────────────────────────────────────────────────────────
pub use registry::ContextRegistrar;

// ── 感知层 ────────────────────────────────────────────────────────────────────
pub use perception::{
    DefaultPerceptionProcessor, PerceptionInput, PerceptionPipeline, PerceptionProcessor,
};

// ── 行动层 ────────────────────────────────────────────────────────────────────
pub use action::{ActionHistory, ActionKind, ActionOutcome, ActionRecord, ActionSummary};

// ── 策略层 ────────────────────────────────────────────────────────────────────
pub use policy::{Policy, PolicyDecision, PolicyEngine, PolicyKind, PolicyRule, RulePolicy};
