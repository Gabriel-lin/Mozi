#![allow(dead_code, unused_imports)]
//! # Agent 子系统
//!
//! ## 模块结构
//!
//! ```text
//! agent/
//!  ├── types.rs      ← AgentMeta / AgentStatus / AgentStep / RunRecord
//!  ├── traits.rs     ← Agent 核心 trait（继承 ToolRegistrar + SkillRegistrar + ContextRegistrar）
//!  ├── registry.rs   ← AgentRegistrar trait + AgentStore（供 Swarm 组合使用）
//!  ├── react.rs      ← ReAct 引擎（Thought → Action → Observation 循环）
//!  ├── task.rs       ← TaskAgent（CoT + ReAct + RAG，通用任务执行者）
//!  ├── sub.rs        ← SubAgent（由 Swarm/WorkflowAgent 动态调度的子代理）
//!  └── workflow.rs   ← WorkflowAgent（DAG 驱动的工作流代理）
//! ```
//!
//! ## 注册关系
//!
//! ```text
//! Agent ──(ToolRegistrar)──────► ToolStore
//!       ──(SkillRegistrar)──────► SkillStore
//!       ──(ContextRegistrar)────► ContextWindow
//!       ──(AgentRegistrar) ────► [被 Swarm 持有]
//! ```

pub mod react;
pub mod registry;
pub mod sub;
pub mod task;
pub mod traits;
pub mod types;
pub mod workflow;

// ── 核心类型 re-export ────────────────────────────────────────────────────────
pub use types::{AgentMeta, AgentStatus, AgentStep, RunRecord};

// ── 核心 Trait re-export ──────────────────────────────────────────────────────
pub use traits::Agent;

// ── 注册器 re-export ──────────────────────────────────────────────────────────
pub use registry::{AgentRegistrar, AgentStore};

// ── ReAct 引擎 re-export ──────────────────────────────────────────────────────
pub use react::{ActionIntent, ActionRequest, ActionResult, ReActEngine, Thought};

// ── 具体实现 re-export ────────────────────────────────────────────────────────
pub use sub::SubAgent;
pub use task::TaskAgent;
pub use workflow::{DagNode, NodeKind, NodeStatus, WorkflowAgent, WorkflowGraph};
