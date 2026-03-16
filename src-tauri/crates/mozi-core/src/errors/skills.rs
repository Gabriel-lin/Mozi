use thiserror::Error;

/// Skills 子系统错误
#[derive(Debug, Error, Clone)]
pub enum SkillsError {
    // ── 注册 ──────────────────────────────────────────────────────────────
    /// Skill ID 未注册
    #[error("技能未找到: {0}")]
    NotFound(String),

    /// Skill ID 已存在，禁止重复注册
    #[error("技能已存在: {0}")]
    AlreadyRegistered(String),

    // ── 执行 ──────────────────────────────────────────────────────────────
    /// 技能调用参数不合法
    #[error("技能参数无效: {0}")]
    InvalidParams(String),

    /// 技能执行逻辑失败
    #[error("技能执行失败: {0}")]
    ExecutionFailed(String),

    /// 技能内部策略触发（重试耗尽、降级失败等）
    #[error("策略失败: {0}")]
    PolicyFailed(String),

    // ── 通用 ──────────────────────────────────────────────────────────────
    #[error("未知技能错误: {0}")]
    Unknown(String),
}
