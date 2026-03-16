#![allow(dead_code)]
use serde::{Deserialize, Serialize};

/// Agent 可执行的动作种类
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ActionKind {
    /// 调用已注册工具
    ToolCall { tool_id: String },
    /// 调用已注册技能
    SkillCall { skill_id: String },
    /// 向用户或外部系统发送消息
    Message { recipient: String },
    /// 外部 HTTP API 请求
    ApiRequest { url: String, method: String },
}

/// 动作执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionOutcome {
    /// 执行成功，携带返回值
    Success(serde_json::Value),
    /// 执行失败，携带错误描述
    Failure(String),
    /// 尚未执行完毕（异步场景）
    Pending,
}
