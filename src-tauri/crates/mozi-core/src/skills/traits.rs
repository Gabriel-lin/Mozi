#![allow(dead_code)]
use crate::errors::SkillsError;

use super::types::{SkillMeta, SkillResult};

/// 所有技能必须实现的核心 Trait
///
/// Skill 是介于工具（`Tool`）和 Agent 之间的可复用行为单元：
/// - 比 `Tool` 更高层：可组合多个工具调用，内置策略
/// - 比 `Agent` 更轻量：无上下文窗口管理，单次同步执行
///
/// ```text
/// Skill
///  ├── meta()    → 静态描述（id / name / description / category）
///  └── execute() → 执行逻辑（接收 JSON 参数，返回结构化结果）
/// ```
pub trait Skill: Send + Sync {
    /// 返回技能的静态元数据
    fn meta(&self) -> &SkillMeta;

    /// 执行技能主逻辑
    ///
    /// - `params`：JSON 格式的调用参数
    /// - 返回 `SkillResult`（内含成功标志和结构化输出）
    /// - 失败时返回 `SkillsError`（由 Agent 决定是否重试/降级）
    fn execute(&self, params: serde_json::Value) -> Result<SkillResult, SkillsError>;

    /// 技能 ID 快捷访问
    fn id(&self) -> &str {
        &self.meta().id
    }

    /// 技能类别快捷访问
    fn category(&self) -> &str {
        &self.meta().category
    }
}
