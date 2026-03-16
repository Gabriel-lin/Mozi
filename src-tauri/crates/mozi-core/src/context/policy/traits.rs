#![allow(dead_code)]
use crate::context::action::ActionKind;
use crate::context::window::ContextWindow;

use super::types::{PolicyDecision, PolicyKind};

/// 策略 Trait
///
/// 输入当前上下文窗口和候选动作列表，输出可选的决策结果。
///
/// 若当前策略无法做出决策（条件不满足 / 不适用），返回 `None`；
/// `PolicyEngine` 会继续询问下一个策略，实现责任链模式。
pub trait Policy: Send + Sync {
    /// 策略标识名（用于日志 / 调试）
    fn name(&self) -> &str;

    /// 策略类型标识
    fn kind(&self) -> PolicyKind;

    /// 依据上下文为候选动作集合做出决策
    ///
    /// - `window`：当前上下文窗口（只读）
    /// - `candidates`：本步骤可供选择的动作列表
    ///
    /// 返回 `None` 表示当前策略弃权，由引擎继续尝试后续策略。
    fn decide(&self, window: &ContextWindow, candidates: &[ActionKind]) -> Option<PolicyDecision>;
}
