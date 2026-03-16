#![allow(dead_code)]
use crate::context::action::ActionKind;
use crate::context::window::ContextWindow;

use super::traits::Policy;
use super::types::PolicyDecision;

/// 策略引擎
///
/// 按注册顺序依次调用各 `Policy::decide()`，返回第一个非 `None` 的结果；
/// 若所有策略均弃权则返回 `None`（责任链 / Chain-of-Responsibility 模式）。
///
/// ```text
/// PolicyEngine
///  ├── [RulePolicy]     ← 最高优先级（先注册）
///  ├── [LLMPolicy]      ← 规则未命中时尝试
///  └── [RLPolicy]       ← 最低优先级兜底
/// ```
pub struct PolicyEngine {
    policies: Vec<Box<dyn Policy>>,
}

impl PolicyEngine {
    pub fn new() -> Self {
        Self {
            policies: Vec::new(),
        }
    }

    /// 注册策略（追加到末尾，优先级低于先注册的策略）
    pub fn register(&mut self, policy: Box<dyn Policy>) {
        self.policies.push(policy);
    }

    /// 依次询问各策略，返回第一个决策结果
    pub fn decide(
        &self,
        window: &ContextWindow,
        candidates: &[ActionKind],
    ) -> Option<PolicyDecision> {
        for policy in &self.policies {
            if let Some(decision) = policy.decide(window, candidates) {
                return Some(decision);
            }
        }
        None
    }

    /// 当前已注册策略数量
    pub fn policy_count(&self) -> usize {
        self.policies.len()
    }

    /// 列出所有策略名称（供调试 / 监控使用）
    pub fn policy_names(&self) -> Vec<&str> {
        self.policies.iter().map(|p| p.name()).collect()
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}
