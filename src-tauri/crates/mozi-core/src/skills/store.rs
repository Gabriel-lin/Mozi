#![allow(dead_code)]
use std::collections::HashMap;
use std::sync::Arc;

use crate::errors::SkillsError;

use super::registry::SkillRegistrar;
use super::traits::Skill;
use super::types::SkillMeta;

/// `SkillRegistrar` 的标准内存实现
///
/// 以 `HashMap<id, Arc<dyn Skill>>` 作为底层存储。
/// 可作为内部字段被组合进 Agent，通过委托满足 `SkillRegistrar`。
pub struct SkillStore {
    skills: HashMap<String, Arc<dyn Skill>>,
}

impl SkillStore {
    pub fn new() -> Self {
        Self {
            skills: HashMap::new(),
        }
    }

    /// 返回所有 Skill 的 Arc 引用列表（供 Agent 批量执行时遍历）
    pub fn all(&self) -> Vec<Arc<dyn Skill>> {
        self.skills.values().cloned().collect()
    }
}

impl Default for SkillStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SkillRegistrar for SkillStore {
    fn register_skill(&mut self, skill: Arc<dyn Skill>) -> Result<(), SkillsError> {
        let id = skill.meta().id.clone();
        if self.skills.contains_key(&id) {
            return Err(SkillsError::AlreadyRegistered(id));
        }
        self.skills.insert(id, skill);
        Ok(())
    }

    fn unregister_skill(&mut self, id: &str) -> Result<(), SkillsError> {
        self.skills
            .remove(id)
            .map(|_| ())
            .ok_or_else(|| SkillsError::NotFound(id.to_string()))
    }

    fn get_skill(&self, id: &str) -> Option<Arc<dyn Skill>> {
        self.skills.get(id).cloned()
    }

    fn list_skills(&self) -> Vec<SkillMeta> {
        let mut metas: Vec<SkillMeta> = self.skills.values().map(|s| s.meta().clone()).collect();
        metas.sort_by(|a, b| a.id.cmp(&b.id));
        metas
    }
}
