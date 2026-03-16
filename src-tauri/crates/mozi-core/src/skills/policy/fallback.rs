#![allow(dead_code)]
//! # FallbackSkill — 降级策略技能
//!
//! 按优先级链尝试多个技能，主技能失败时自动切换到下一个备选技能，
//! 直到有一个成功或所有备选均失败后返回 `SkillsError::PolicyFailed`。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 降级技能配置
#[derive(Debug, Clone)]
pub struct FallbackConfig {
    /// 主技能 ID（第一个尝试）
    pub primary_skill_id: String,
    /// 备选技能 ID 列表（按顺序依次尝试）
    pub fallback_skill_ids: Vec<String>,
    /// 是否在降级时记录警告日志
    pub log_fallback: bool,
}

impl Default for FallbackConfig {
    fn default() -> Self {
        Self {
            primary_skill_id: String::new(),
            fallback_skill_ids: vec![],
            log_fallback: true,
        }
    }
}

/// 降级策略技能
///
/// # 参数（execute params）
/// 透传给每个被尝试技能的参数：
/// ```json
/// { "shared_params": { … } }
/// ```
pub struct FallbackSkill {
    meta: SkillMeta,
    config: FallbackConfig,
}

impl FallbackSkill {
    pub fn new(config: FallbackConfig) -> Self {
        let chain = std::iter::once(config.primary_skill_id.as_str())
            .chain(config.fallback_skill_ids.iter().map(|s| s.as_str()))
            .collect::<Vec<_>>()
            .join(" → ");
        Self {
            meta: SkillMeta {
                id: format!("skill.policy.fallback.{}", config.primary_skill_id),
                name: "降级策略".into(),
                description: format!("技能降级链: {}", chain),
                version: "0.1.0".into(),
                category: "policy".into(),
            },
            config,
        }
    }
}

impl Skill for FallbackSkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let shared_params = params["shared_params"].clone();
        let chain: Vec<&str> = std::iter::once(self.config.primary_skill_id.as_str())
            .chain(self.config.fallback_skill_ids.iter().map(|s| s.as_str()))
            .collect();

        // TODO: 从 SkillStore 依次获取技能并执行，遇到成功立即返回
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "chain": chain,
                "shared_params": shared_params,
                "status": "pending_execution"
            }),
        ))
    }
}
