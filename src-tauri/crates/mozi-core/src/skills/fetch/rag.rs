#![allow(dead_code)]
//! # RagSkill — 检索增强生成技能
//!
//! 从向量数据库 / 知识库中检索与当前查询最相关的文档片段，
//! 注入上下文以提升 LLM 回复的准确性和时效性。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// RAG 检索技能配置
#[derive(Debug, Clone)]
pub struct RagConfig {
    /// 向量数据库服务端点
    pub endpoint: String,
    /// 知识库 / Collection 名称
    pub collection: String,
    /// 检索返回的最大片段数（top-k）
    pub top_k: usize,
    /// 相似度阈值（低于此值的结果被过滤）
    pub score_threshold: f32,
}

impl Default for RagConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://localhost:6333".into(),
            collection: "default".into(),
            top_k: 5,
            score_threshold: 0.7,
        }
    }
}

/// RAG 检索增强技能
///
/// # 参数（execute params）
/// ```json
/// { "query": "检索问题文本" }
/// ```
pub struct RagSkill {
    meta: SkillMeta,
    config: RagConfig,
}

impl RagSkill {
    pub fn new(config: RagConfig) -> Self {
        Self {
            meta: SkillMeta {
                id: "skill.fetch.rag".into(),
                name: "RAG 检索".into(),
                description: "从向量数据库检索相关文档片段，增强 LLM 上下文".into(),
                version: "0.1.0".into(),
                category: "fetch".into(),
            },
            config,
        }
    }
}

impl Default for RagSkill {
    fn default() -> Self {
        Self::new(RagConfig::default())
    }
}

impl Skill for RagSkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let query = params["query"]
            .as_str()
            .ok_or_else(|| SkillsError::InvalidParams("缺少 query 字段".into()))?;

        // TODO: 调用向量数据库 API 检索片段
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "query": query,
                "hits": [],
                "collection": self.config.collection,
                "top_k": self.config.top_k
            }),
        ))
    }
}
