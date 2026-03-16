#![allow(dead_code)]
//! # UserConfirmSkill — 用户确认技能
//!
//! 在执行高风险操作（删除文件、发送邮件、下单等）前暂停并请求用户明确授权，
//! 降低 Agent 自主执行带来的误操作风险。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 确认模式
#[derive(Debug, Clone)]
pub enum ConfirmMode {
    /// 阻塞等待用户输入（CLI / 对话场景）
    Blocking,
    /// 异步通知（推送确认链接 / 按钮）
    Async { callback_url: String },
    /// 超时自动拒绝
    Timeout { timeout_ms: u64 },
}

/// 用户确认技能配置
#[derive(Debug, Clone)]
pub struct UserConfirmConfig {
    pub mode: ConfirmMode,
    /// 操作的高级描述（展示给用户）
    pub action_label: String,
}

impl Default for UserConfirmConfig {
    fn default() -> Self {
        Self {
            mode: ConfirmMode::Timeout { timeout_ms: 30_000 },
            action_label: "请确认此操作".into(),
        }
    }
}

/// 用户确认技能
///
/// # 参数（execute params）
/// ```json
/// { "prompt": "您确定要删除 XXX 吗？", "default": "reject" }
/// ```
pub struct UserConfirmSkill {
    meta: SkillMeta,
    config: UserConfirmConfig,
}

impl UserConfirmSkill {
    pub fn new(config: UserConfirmConfig) -> Self {
        Self {
            meta: SkillMeta {
                id: "skill.interactive.confirm".into(),
                name: "用户确认".into(),
                description: "高风险操作前请求用户明确授权，防止误操作".into(),
                version: "0.1.0".into(),
                category: "interactive".into(),
            },
            config,
        }
    }
}

impl Default for UserConfirmSkill {
    fn default() -> Self {
        Self::new(UserConfirmConfig::default())
    }
}

impl Skill for UserConfirmSkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let prompt = params["prompt"]
            .as_str()
            .unwrap_or(&self.config.action_label);
        let default = params["default"].as_str().unwrap_or("reject");

        // TODO: 根据 ConfirmMode 暂停执行并等待用户输入
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "prompt": prompt,
                "default": default,
                "status": "awaiting_confirm"
            }),
        ))
    }
}
