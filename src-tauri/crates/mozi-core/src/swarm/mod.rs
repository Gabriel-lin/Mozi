#![allow(dead_code, unused_imports)]
//! # Swarm 子系统（Agent 集群协作）
//!
//! ## 模块结构
//!
//! ```text
//! swarm/
//!  ├── types.rs       ← SwarmMode / SwarmMeta / SwarmStatus / SubTask / TaskPriority / AggregatedResult
//!  ├── traits.rs      ← Swarm 核心 trait（继承 AgentRegistrar + ToolRegistrar + ContextRegistrar）
//!  ├── scheduler.rs   ← Scheduler（RoundRobin / LoadBalanced / Priority / Affinity 四种策略）
//!  ├── coordinator.rs ← MessageBus + SwarmEvent（集群内部消息 / 事件总线）
//!  ├── master.rs      ← MasterSlaveSwarm（主从模式：Master 拆解 → Scheduler 分发 → 汇总）
//!  └── collab.rs      ← CollaborativeSwarm（对等协作：P2P 消息 + 平均分发）
//! ```
//!
//! ## 两种协作模式对比
//!
//! ```text
//! MasterSlaveSwarm                   CollaborativeSwarm
//!   goal                               goal
//!    │                                  │ (平均分发给所有 Agent)
//!    ▼                                  ├──► Agent A ──► result A
//!  Master (LLM 拆解)                   ├──► Agent B ──► result B
//!    ├──► SubAgent A ──► result A      └──► Agent C ──► result C
//!    ├──► SubAgent B ──► result B               │
//!    └──► SubAgent C ──► result C         MessageBus (P2P 消息)
//!              │                                │
//!         Scheduler (分发策略)           aggregate_results()
//!              │
//!         aggregate_results()
//! ```
//!
//! ## 注册关系
//!
//! ```text
//! Swarm ──(AgentRegistrar)───► AgentStore
//!       ──(ToolRegistrar)────► ToolStore（集群级共享工具）
//!       ──(ContextRegistrar)─► ContextWindow（集群级共享上下文）
//! ```

pub mod collab;
pub mod coordinator;
pub mod master;
pub mod scheduler;
pub mod traits;
pub mod types;

// ── 核心类型 ──────────────────────────────────────────────────────────────────
pub use types::{AggregatedResult, SubTask, SwarmMeta, SwarmMode, SwarmStatus, TaskPriority};

// ── 核心 Trait ────────────────────────────────────────────────────────────────
pub use traits::Swarm;

// ── 调度器 ────────────────────────────────────────────────────────────────────
pub use scheduler::{AgentLoad, ScheduleStrategy, Scheduler, TaskRequest};

// ── 协调层 ────────────────────────────────────────────────────────────────────
pub use coordinator::{MessageBus, SwarmEvent};

// ── 具体实现 ──────────────────────────────────────────────────────────────────
pub use collab::CollaborativeSwarm;
pub use master::MasterSlaveSwarm;
