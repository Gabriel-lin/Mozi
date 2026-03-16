#![allow(dead_code)]
//! # LongTermMemorySkill — 长期记忆技能
//!
//! 将重要事实、用户偏好、任务成果持久化到外部存储（向量数据库 / 图数据库），
//! 并在需要时通过语义检索召回，实现跨会话的知识积累。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 长期记忆操作类型
#[derive(Debug, Clone)]
pub enum LongTermOp {
    /// 存储记忆片段
    Store,
    /// 语义检索记忆
    Recall,
    /// 删除记忆片段
    Forget,
}

/// 长期记忆配置
#[derive(Debug, Clone)]
pub struct LongTermConfig {
    /// 存储后端端点（向量数据库 / 图数据库）
    pub store_endpoint: String,
    /// 命名空间（按用户 / 项目隔离数据）
    pub namespace: String,
    /// 召回时的 top-k 数量
    pub recall_top_k: usize,
}

impl Default for LongTermConfig {
    fn default() -> Self {
        Self {
            store_endpoint: "http://localhost:6333".into(),
            namespace: "default".into(),
            recall_top_k: 10,
        }
    }
}

/// 长期记忆技能
///
/// # 参数（execute params）
/// - **存储**：`{ "op": "store", "content": "记忆内容", "tags": ["…"] }`
/// - **召回**：`{ "op": "recall", "query": "检索问题" }`
/// - **遗忘**：`{ "op": "forget", "id": "记忆片段 ID" }`
pub struct LongTermMemorySkill {
    meta: SkillMeta,
    config: LongTermConfig,
}

impl LongTermMemorySkill {
    pub fn new(config: LongTermConfig) -> Self {
        Self {
            meta: SkillMeta {
                id: "skill.memory.long_term".into(),
                name: "长期记忆".into(),
                description: "持久化重要事实并通过语义检索跨会话召回".into(),
                version: "0.1.0".into(),
                category: "memory".into(),
            },
            config,
        }
    }
}

impl Default for LongTermMemorySkill {
    fn default() -> Self {
        Self::new(LongTermConfig::default())
    }
}

impl Skill for LongTermMemorySkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let op = params["op"].as_str().ok_or_else(|| {
            SkillsError::InvalidParams("缺少 op 字段（store/recall/forget）".into())
        })?;

        match op {
            "store" => {
                let content = params["content"]
                    .as_str()
                    .ok_or_else(|| SkillsError::InvalidParams("store 操作缺少 content".into()))?;
                // TODO: 编码为向量并持久化
                Ok(SkillResult::ok(
                    &self.meta.id,
                    serde_json::json!({ "op": "store", "stored": true, "content_preview": &content[..content.len().min(50)] }),
                ))
            }
            "recall" => {
                let query = params["query"]
                    .as_str()
                    .ok_or_else(|| SkillsError::InvalidParams("recall 操作缺少 query".into()))?;
                // TODO: 向量检索
                Ok(SkillResult::ok(
                    &self.meta.id,
                    serde_json::json!({ "op": "recall", "query": query, "hits": [] }),
                ))
            }
            "forget" => {
                let id = params["id"]
                    .as_str()
                    .ok_or_else(|| SkillsError::InvalidParams("forget 操作缺少 id".into()))?;
                // TODO: 删除向量记录
                Ok(SkillResult::ok(
                    &self.meta.id,
                    serde_json::json!({ "op": "forget", "deleted_id": id }),
                ))
            }
            other => Err(SkillsError::InvalidParams(format!("未知操作: {}", other))),
        }
    }
}
