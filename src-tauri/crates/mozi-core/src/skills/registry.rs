#![allow(dead_code)]
use std::sync::Arc;

use crate::errors::SkillsError;

use super::traits::Skill;
use super::types::SkillMeta;

/// 技能注册器 Trait
///
/// 任何可以**持有并管理技能集合**的主体（Agent）实现此接口。
///
/// ```text
/// Agent
///  └── SkillStore ──(impl SkillRegistrar)──► [Skill, Skill, …]
/// ```
pub trait SkillRegistrar: Send + Sync {
    /// 注册技能
    ///
    /// ID 已存在时返回 `SkillsError::AlreadyRegistered`。
    fn register_skill(&mut self, skill: Arc<dyn Skill>) -> Result<(), SkillsError>;

    /// 注销技能
    ///
    /// ID 不存在时返回 `SkillsError::NotFound`。
    fn unregister_skill(&mut self, id: &str) -> Result<(), SkillsError>;

    /// 按 ID 获取技能的 `Arc` 引用
    fn get_skill(&self, id: &str) -> Option<Arc<dyn Skill>>;

    /// 按类别过滤技能元数据（供 Agent 决策时浏览可用技能）
    fn list_skills_by_category(&self, category: &str) -> Vec<SkillMeta> {
        self.list_skills()
            .into_iter()
            .filter(|m| m.category == category)
            .collect()
    }

    /// 返回所有已注册技能的元数据（按 ID 排序）
    fn list_skills(&self) -> Vec<SkillMeta>;

    /// 技能是否已注册
    fn has_skill(&self, id: &str) -> bool {
        self.get_skill(id).is_some()
    }

    /// 已注册技能总数
    fn skill_count(&self) -> usize {
        self.list_skills().len()
    }
}
