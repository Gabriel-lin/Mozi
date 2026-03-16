#![allow(dead_code)]
//! # RetrySkill — 重试策略技能
//!
//! 对目标技能的调用失败进行自动重试，支持固定延迟和指数退避两种策略。
//! 重试次数耗尽后返回最后一次错误或 `SkillsError::PolicyFailed`。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 退避策略
#[derive(Debug, Clone)]
pub enum BackoffStrategy {
    /// 固定延迟（每次重试间隔相同）
    Fixed { delay_ms: u64 },
    /// 指数退避（delay_ms × 2^n）
    Exponential { base_ms: u64, max_ms: u64 },
}

/// 重试技能配置
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// 被包装的目标技能 ID
    pub target_skill_id: String,
    /// 最大重试次数（不含首次调用）
    pub max_retries: u32,
    /// 退避策略
    pub backoff: BackoffStrategy,
    /// 仅在特定错误上重试（空列表 = 所有错误）
    pub retryable_patterns: Vec<String>,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            target_skill_id: String::new(),
            max_retries: 3,
            backoff: BackoffStrategy::Exponential {
                base_ms: 100,
                max_ms: 5000,
            },
            retryable_patterns: vec![],
        }
    }
}

/// 重试策略技能
///
/// # 参数（execute params）
/// 透传给目标技能的参数，附加可选字段：
/// ```json
/// { "target_params": { … }, "max_retries": 3 }
/// ```
pub struct RetrySkill {
    meta: SkillMeta,
    config: RetryConfig,
}

impl RetrySkill {
    pub fn new(config: RetryConfig) -> Self {
        let id = format!("skill.policy.retry.{}", config.target_skill_id);
        Self {
            meta: SkillMeta {
                id,
                name: "重试策略".into(),
                description: format!(
                    "对技能 {} 的调用失败自动重试（最多 {} 次）",
                    config.target_skill_id, config.max_retries
                ),
                version: "0.1.0".into(),
                category: "policy".into(),
            },
            config,
        }
    }
}

impl Skill for RetrySkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let target_params = params["target_params"].clone();
        let max_retries = params["max_retries"]
            .as_u64()
            .unwrap_or(self.config.max_retries as u64) as u32;

        // TODO: 从 SkillStore 获取目标技能并循环调用（含退避睡眠）
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "target": self.config.target_skill_id,
                "max_retries": max_retries,
                "target_params": target_params,
                "status": "pending_execution"
            }),
        ))
    }
}
