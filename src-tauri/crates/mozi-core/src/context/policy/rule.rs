#![allow(dead_code)]
use crate::context::action::ActionKind;
use crate::context::window::ContextWindow;

use super::traits::Policy;
use super::types::{PolicyDecision, PolicyKind};

/// 单条策略规则
pub struct PolicyRule {
    /// 规则优先级（数值越大越优先执行）
    pub priority: i32,
    /// 规则名称（用于日志 / 错误追踪）
    pub name: String,
    /// 触发条件：检查上下文窗口是否满足条件
    pub condition: Box<dyn Fn(&ContextWindow) -> bool + Send + Sync>,
    /// 条件满足时执行的目标动作
    pub action: ActionKind,
}

/// 规则（Rule）策略
///
/// 维护一组 `PolicyRule`，按 `priority` 降序排列；
/// `decide()` 遍历规则列表，命中第一条满足条件且在候选集中的规则即返回决策。
pub struct RulePolicy {
    rules: Vec<PolicyRule>,
}

impl RulePolicy {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    /// 注册规则（注册后按优先级降序重排）
    pub fn add_rule(&mut self, rule: PolicyRule) {
        self.rules.push(rule);
        self.rules.sort_by(|a, b| b.priority.cmp(&a.priority));
    }

    /// 当前规则数量
    pub fn rule_count(&self) -> usize {
        self.rules.len()
    }
}

impl Default for RulePolicy {
    fn default() -> Self {
        Self::new()
    }
}

impl Policy for RulePolicy {
    fn name(&self) -> &str {
        "rule_policy"
    }

    fn kind(&self) -> PolicyKind {
        PolicyKind::Rule
    }

    fn decide(&self, window: &ContextWindow, candidates: &[ActionKind]) -> Option<PolicyDecision> {
        for rule in &self.rules {
            if !candidates.contains(&rule.action) {
                continue;
            }
            if (rule.condition)(window) {
                return Some(PolicyDecision {
                    selected: rule.action.clone(),
                    confidence: 1.0,
                    reasoning: Some(format!("规则命中: {}", rule.name)),
                    policy_kind: PolicyKind::Rule,
                });
            }
        }
        None
    }
}
