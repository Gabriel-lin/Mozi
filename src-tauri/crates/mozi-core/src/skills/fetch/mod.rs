#![allow(dead_code, unused_imports)]
//! # 信息获取技能（Fetch）
//!
//! 负责从外部数据源主动拉取信息，注入 Agent 上下文。
//!
//! ```text
//! fetch/
//!  ├── rag.rs    ← RagSkill（向量数据库检索增强）
//!  └── search.rs ← WebSearchSkill（实时网络搜索）
//! ```

pub mod rag;
pub mod search;

pub use rag::{RagConfig, RagSkill};
pub use search::{SearchEngine, WebSearchConfig, WebSearchSkill};
