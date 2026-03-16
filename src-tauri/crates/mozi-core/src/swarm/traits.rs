#![allow(dead_code)]
use crate::agent::AgentRegistrar;
use crate::context::ContextRegistrar;
use crate::errors::SwarmError;
use crate::tools::registry::ToolRegistrar;

use super::types::{AggregatedResult, SubTask, SwarmMeta, SwarmStatus};

/// Swarm 核心 Trait
///
/// 通过多重继承将三类管理能力绑定在一起：
///
/// | 继承的 Trait      | 赋予的能力                     |
/// |-----------------|-------------------------------|
/// | `AgentRegistrar` | 持有并调度 Agent 集合          |
/// | `ToolRegistrar`  | 维护集群级共享工具              |
/// | `ContextRegistrar`| 持有集群级共享上下文           |
///
/// ## 实现约定
/// - 集群级工具/上下文会在 `dispatch()` 时自动广播给所有子 Agent
/// - `shutdown()` 应确保所有子 Agent 均已优雅退出
pub trait Swarm: AgentRegistrar + ToolRegistrar + ContextRegistrar + Send + Sync {
    /// 返回 Swarm 元数据（只读）
    fn meta(&self) -> &SwarmMeta;

    /// 当前集群状态
    fn status(&self) -> SwarmStatus;

    /// 提交集群级任务并启动调度（返回 dispatch_id）
    ///
    /// 由 MasterAgent 或内置调度器将目标拆解为 `SubTask` 列表并分配给 Agent。
    fn dispatch(&mut self, goal: &str) -> Result<String, SwarmError>;

    /// 返回所有子任务的执行快照（只读）
    fn sub_tasks(&self) -> &[SubTask];

    /// 聚合所有子任务结果（map-reduce 式汇总）
    fn aggregate_results(&self) -> AggregatedResult;

    /// 终止整个集群，释放所有 Agent 资源
    fn shutdown(&mut self) -> Result<(), SwarmError>;
}
