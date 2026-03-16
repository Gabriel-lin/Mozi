#![allow(dead_code, unused_imports)]

#[cfg(feature = "agent")]
pub mod agent;
#[cfg(feature = "context")]
pub mod context;
#[cfg(feature = "skills")]
pub mod skills;
#[cfg(feature = "swarm")]
pub mod swarm;
pub mod sys;
#[cfg(feature = "tools")]
pub mod tool;

#[cfg(feature = "agent")]
pub use agent::AgentError;
#[cfg(feature = "context")]
pub use context::ContextError;
#[cfg(feature = "skills")]
pub use skills::SkillsError;
#[cfg(feature = "swarm")]
pub use swarm::SwarmError;
pub use sys::SysError;
#[cfg(feature = "tools")]
pub use tool::ToolError;

use thiserror::Error;

/// 顶层统一错误：所有子系统错误的公共封装
#[derive(Debug, Error)]
pub enum AppError {
    #[cfg(feature = "tools")]
    #[error(transparent)]
    Tool(#[from] ToolError),

    #[cfg(feature = "agent")]
    #[error(transparent)]
    Agent(#[from] AgentError),

    #[cfg(feature = "context")]
    #[error(transparent)]
    Context(#[from] ContextError),

    #[cfg(feature = "skills")]
    #[error(transparent)]
    Skills(#[from] SkillsError),

    #[cfg(feature = "swarm")]
    #[error(transparent)]
    Swarm(#[from] SwarmError),

    #[error(transparent)]
    Sys(#[from] SysError),

    #[error("应用错误: {0}")]
    Other(String),
}
