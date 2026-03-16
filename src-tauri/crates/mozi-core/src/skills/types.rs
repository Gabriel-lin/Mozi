#![allow(dead_code)]
use serde::{Deserialize, Serialize};

// ─────────────────────────── 技能元数据 ──────────────────────────────────────

/// 技能静态描述（注册时写入，不可变）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMeta {
    /// 全局唯一 ID（注册键）
    pub id: String,
    /// 可读名称
    pub name: String,
    /// 功能描述（供 Agent 决策时参考）
    pub description: String,
    /// 语义版本号（"1.0.0" 格式）
    pub version: String,
    /// 所属类别（"fetch" / "memory" / "policy" / "interactive" 等）
    pub category: String,
}

// ─────────────────────────── 执行结果 ────────────────────────────────────────

/// 技能执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillResult {
    /// 对应的技能 ID
    pub skill_id: String,
    /// 结构化输出
    pub output: serde_json::Value,
    /// 是否成功
    pub success: bool,
    /// 可读消息（成功摘要或失败原因）
    pub message: Option<String>,
}

impl SkillResult {
    /// 快速构造成功结果
    pub fn ok(skill_id: impl Into<String>, output: serde_json::Value) -> Self {
        Self {
            skill_id: skill_id.into(),
            output,
            success: true,
            message: None,
        }
    }

    /// 快速构造失败结果
    pub fn err(skill_id: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            skill_id: skill_id.into(),
            output: serde_json::Value::Null,
            success: false,
            message: Some(reason.into()),
        }
    }
}

// ─────────────────────────── 执行状态 ────────────────────────────────────────

/// 技能执行生命周期状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillStatus {
    /// 等待调用
    Idle,
    /// 执行中
    Running,
    /// 成功完成
    Completed,
    /// 执行失败
    Failed(String),
    /// 被主动取消
    Cancelled,
}
