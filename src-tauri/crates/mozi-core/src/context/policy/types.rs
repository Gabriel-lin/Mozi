#![allow(dead_code)]
use serde::{Deserialize, Serialize};

use crate::context::action::ActionKind;

/// 策略实现类型标识
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyKind {
    /// 规则驱动（关键词 / 条件触发），零延迟，可解释
    Rule,
    /// LLM 推理（调用语言模型打分选择动作）
    LLM,
    /// 在线强化学习（基于 reward 信号自适应调整）
    RLOnline,
}

/// 策略决策结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDecision {
    /// 选中的动作
    pub selected: ActionKind,
    /// 决策置信度（0.0 – 1.0）
    pub confidence: f32,
    /// 决策依据（可选，供日志 / 解释使用）
    pub reasoning: Option<String>,
    /// 做出本次决策的策略类型
    pub policy_kind: PolicyKind,
}
