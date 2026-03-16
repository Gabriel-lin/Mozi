//! # mozi-core
//!
//! Mozi Agent 框架核心库，提供 Agent、工具、技能、上下文、集群等子系统。
//!
//! ## Feature Flags
//!
//! | feature   | 说明                           | 依赖                |
//! |-----------|-------------------------------|---------------------|
//! | `tools`   | 工具注册 / 调度 / 适配器        | uuid, tokio         |
//! | `skills`  | 技能 trait + 内置技能           | —                   |
//! | `context` | 上下文窗口 / 感知 / 策略        | tools               |
//! | `agent`   | Agent trait + TaskAgent 等     | tools, skills, context |
//! | `swarm`   | 集群协作（主从 / 对等）          | agent, tools, context |
//! | `system`  | 系统信息采集（CPU / 磁盘 / 网络）| sysinfo             |
//! | `menu`    | 菜单状态管理                    | —                   |
//! | `full`    | 开启所有模块                    | 全部                 |

pub mod errors;

#[cfg(feature = "tools")]
pub mod tools;

#[cfg(feature = "skills")]
pub mod skills;

#[cfg(feature = "context")]
pub mod context;

#[cfg(feature = "agent")]
pub mod agent;

#[cfg(feature = "swarm")]
pub mod swarm;

#[cfg(feature = "system")]
pub mod system;

#[cfg(feature = "menu")]
pub mod menu;
