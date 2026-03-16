#![allow(dead_code)]
//! # WebSearchSkill — 网络搜索技能
//!
//! 调用外部搜索引擎 API（如 Brave、SerpAPI、Bing）获取实时网页摘要，
//! 供 Agent 获取最新信息（新闻、价格、文档等）。

use crate::errors::SkillsError;
use crate::skills::traits::Skill;
use crate::skills::types::{SkillMeta, SkillResult};

/// 搜索引擎类型
#[derive(Debug, Clone)]
pub enum SearchEngine {
    Brave,
    Bing,
    SerpApi,
    Custom { endpoint: String },
}

/// 网络搜索技能配置
#[derive(Debug, Clone)]
pub struct WebSearchConfig {
    pub engine: SearchEngine,
    /// API Key（可通过环境变量注入）
    pub api_key: String,
    /// 最大返回结果数
    pub max_results: u32,
    /// 搜索结果语言（"zh-CN"、"en-US" 等）
    pub lang: String,
}

impl Default for WebSearchConfig {
    fn default() -> Self {
        Self {
            engine: SearchEngine::Brave,
            api_key: String::new(),
            max_results: 5,
            lang: "zh-CN".into(),
        }
    }
}

/// 网络搜索技能
///
/// # 参数（execute params）
/// ```json
/// { "query": "搜索关键词", "max_results": 5 }
/// ```
pub struct WebSearchSkill {
    meta: SkillMeta,
    config: WebSearchConfig,
}

impl WebSearchSkill {
    pub fn new(config: WebSearchConfig) -> Self {
        Self {
            meta: SkillMeta {
                id: "skill.fetch.search".into(),
                name: "网络搜索".into(),
                description: "调用搜索引擎获取实时网页摘要，弥补 LLM 知识截止日期不足".into(),
                version: "0.1.0".into(),
                category: "fetch".into(),
            },
            config,
        }
    }
}

impl Default for WebSearchSkill {
    fn default() -> Self {
        Self::new(WebSearchConfig::default())
    }
}

impl Skill for WebSearchSkill {
    fn meta(&self) -> &SkillMeta {
        &self.meta
    }

    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError> {
        let query = params["query"]
            .as_str()
            .ok_or_else(|| SkillsError::InvalidParams("缺少 query 字段".into()))?;

        let max_results = params["max_results"]
            .as_u64()
            .unwrap_or(self.config.max_results as u64) as u32;

        // TODO: 调用搜索引擎 API
        Ok(SkillResult::ok(
            &self.meta.id,
            serde_json::json!({
                "query": query,
                "results": [],
                "max_results": max_results
            }),
        ))
    }
}
