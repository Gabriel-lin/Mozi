#![allow(dead_code)]
//! # ShortTermMemorySkill — 短期记忆技能
//!
//! 对 `ContextWindow` 最近 N 条对话进行摘要压缩，
//! 防止上下文超出 LLM token 限制，同时保留关键信息。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 短期记忆压缩配置
#[derive(Debug, Clone)]
pub struct ShortTermConfig {
    /// 触发压缩的条目阈值（超过此数量时自动压缩）
    pub compress_threshold: usize,
    /// 压缩后保留的摘要最大字符数
    pub max_summary_chars: usize,
    /// 压缩所用模型（留空则使用 Agent 默认模型）
    pub summary_model: Option<String>,
}

impl Default for ShortTermConfig {
    fn default() -> Self {
        Self {
            compress_threshold: 20,
            max_summary_chars: 500,
            summary_model: None,
        }
    }
}

/// 短期记忆技能
///
/// # 参数（execute params）
/// ```json
/// { "entries": [ { "role": "user", "content": "..." }, … ] }
/// ```
pub struct ShortTermMemorySkill {
    meta: SkillMeta,
    config: ShortTermConfig,
}

impl ShortTermMemorySkill {
    pub fn new(config: ShortTermConfig) -> Self {
        Self {
            meta: SkillMeta {
                id: "skill.memory.short_term".into(),
                name: "短期记忆压缩".into(),
                description: "摘要压缩近期对话条目，保持上下文窗口在 token 限制内".into(),
                version: "0.1.0".into(),
                category: "memory".into(),
            },
            config,
        }
    }
}

impl Default for ShortTermMemorySkill {
    fn default() -> Self {
        Self::new(ShortTermConfig::default())
    }
}

impl Skill for ShortTermMemorySkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let entries = params["entries"]
            .as_array()
            .ok_or_else(|| SkillsError::InvalidParams("缺少 entries 字段".into()))?;

        if entries.len() < self.config.compress_threshold {
            return Ok(SkillResult::ok(
                &self.meta.id,
                serde_json::json!({ "compressed": false, "reason": "条目数未达到阈值" }),
            ));
        }

        // TODO: 调用 LLM 对 entries 进行摘要
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "compressed": true,
                "original_count": entries.len(),
                "summary": "（摘要占位）"
            }),
        ))
    }
}
