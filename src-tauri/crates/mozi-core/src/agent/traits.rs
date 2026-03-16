#![allow(dead_code)]
use std::collections::HashMap;

use crate::context::ContextRegistrar;
use crate::errors::AgentError;
use crate::skills::SkillRegistrar;
use crate::tools::registry::ToolRegistrar;

use super::types::{AgentMeta, AgentStatus, AgentStep};

/// Agent 核心 Trait
///
/// 通过多重继承将三类能力绑定在一起：
///
/// | 继承的 Trait    | 赋予的能力           |
/// |----------------|---------------------|
/// | `ToolRegistrar` | 持有并调用工具       |
/// | `SkillRegistrar`| 持有并调用技能       |
/// | `ContextRegistrar`| 维护上下文窗口     |
///
/// 具体 Agent 实现（`TaskAgent`、`SubAgent`、`WorkflowAgent`）通过
/// 内嵌各自的 `ToolStore` / `SkillStore` / `ContextWindow`，
/// 用**委托模式**满足上述三个 Registrar 的要求。
pub trait Agent: ToolRegistrar + SkillRegistrar + ContextRegistrar + Send + Sync {
    // ── 元数据 ────────────────────────────────────────────────────────────

    /// 返回不可变元数据
    fn meta(&self) -> &AgentMeta;

    /// 当前生命周期状态
    fn status(&self) -> AgentStatus;

    // ── 执行控制 ──────────────────────────────────────────────────────────

    /// 提交顶层目标，启动 ReAct 循环（返回 `run_id`）
    ///
    /// 实现应将目标写入内部状态并把 `status` 切换为 `Planning`；
    /// 实际循环推进由 `step()` 完成。
    fn run(
        &mut self,
        goal: &str,
        params: HashMap<String, serde_json::Value>,
    ) -> Result<String, AgentError>;

    /// 执行 ReAct 循环的**单步**（Thought → Action → Observation）
    ///
    /// 返回本步的记录；若 Agent 已终止则返回 `AgentError::Stopped`。
    fn step(&mut self) -> Result<AgentStep, AgentError>;

    /// 终止当前任务，将 `status` 切换为 `Failed(reason)`
    fn stop(&mut self) -> Result<(), AgentError>;

    // ── 历史查询 ──────────────────────────────────────────────────────────

    /// 返回当前 run 的完整步骤历史（只读切片）
    fn history(&self) -> &[AgentStep];
}
