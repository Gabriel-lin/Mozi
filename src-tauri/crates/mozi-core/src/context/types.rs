#![allow(dead_code)]
use serde::{Deserialize, Serialize};

// ─────────────────────────── 条目来源 ────────────────────────────────────────

/// 上下文条目的来源类型
///
/// 用于在 `ContextWindow` 中按来源筛选条目，以及在感知层判断数据流向。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextSource {
    /// 来自用户的输入（文本、语音、图像等经感知层处理后的结果）
    User,
    /// 来自 Agent 自身的推理输出（Thought / 计划）
    Agent,
    /// 来自工具调用的返回结果
    Tool,
    /// 来自系统层（启动参数、配置、环境变量等）
    System,
    /// 来自记忆模块（长期知识检索、历史摘要等）
    Memory,
}

// ─────────────────────────── 单条上下文条目 ──────────────────────────────────

/// 单条上下文条目（上下文窗口的基本存储单元）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    /// 全局唯一 ID（生成时赋值）
    pub id: String,
    /// 数据来源
    pub source: ContextSource,
    /// 结构化内容（由感知层或工具层填充）
    pub content: serde_json::Value,
    /// 生成时间戳（Unix 毫秒）
    pub timestamp_ms: u64,
}

impl ContextEntry {
    /// 快速构造一条条目
    pub fn new(source: ContextSource, content: serde_json::Value) -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            source,
            content,
            timestamp_ms,
        }
    }
}
