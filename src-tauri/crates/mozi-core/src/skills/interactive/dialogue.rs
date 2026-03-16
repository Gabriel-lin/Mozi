#![allow(dead_code)]
//! # MultiTurnDialogueSkill — 多轮对话技能
//!
//! 当单次 LLM 调用无法满足用户意图时，驱动 Agent 与用户进行多轮澄清对话，
//! 直到收集到足够信息或超过最大轮次后返回结构化结果。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 对话轮次记录
#[derive(Debug, Clone)]
pub struct DialogueTurn {
    pub turn_id: u32,
    /// Agent 提问内容
    pub agent_prompt: String,
    /// 用户回答内容（`None` 表示尚未回答）
    pub user_response: Option<String>,
}

/// 多轮对话技能配置
#[derive(Debug, Clone)]
pub struct MultiTurnConfig {
    /// 最大轮次（超出后强制结束对话）
    pub max_turns: u32,
    /// 每轮等待用户回答的超时（毫秒）
    pub turn_timeout_ms: u64,
    /// 对话目标描述（用于生成开场白）
    pub goal: String,
}

impl Default for MultiTurnConfig {
    fn default() -> Self {
        Self {
            max_turns: 5,
            turn_timeout_ms: 60_000,
            goal: "收集必要信息".into(),
        }
    }
}

/// 多轮对话技能
///
/// # 参数（execute params）
/// ```json
/// {
///   "goal": "需要澄清的目标描述",
///   "initial_context": { … },
///   "max_turns": 5
/// }
/// ```
pub struct MultiTurnDialogueSkill {
    meta: SkillMeta,
    config: MultiTurnConfig,
}

impl MultiTurnDialogueSkill {
    pub fn new(config: MultiTurnConfig) -> Self {
        Self {
            meta: SkillMeta {
                id: "skill.interactive.dialogue".into(),
                name: "多轮对话".into(),
                description: "通过多轮澄清对话收集完整的用户意图和必要信息".into(),
                version: "0.1.0".into(),
                category: "interactive".into(),
            },
            config,
        }
    }
}

impl Default for MultiTurnDialogueSkill {
    fn default() -> Self {
        Self::new(MultiTurnConfig::default())
    }
}

impl Skill for MultiTurnDialogueSkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let goal = params["goal"].as_str().unwrap_or(&self.config.goal);
        let max_turns = params["max_turns"]
            .as_u64()
            .unwrap_or(self.config.max_turns as u64) as u32;

        // TODO: 驱动多轮提问 → 用户作答 → 意图确认循环
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "goal": goal,
                "max_turns": max_turns,
                "turns": [],
                "status": "dialogue_started"
            }),
        ))
    }
}
