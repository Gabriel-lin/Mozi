#![allow(dead_code)]
use serde::{Deserialize, Serialize};

// ─────────────────────────── 元数据 ──────────────────────────────────────────

/// Agent 静态描述（不可变，注册时写入）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMeta {
    /// 全局唯一 ID（注册键）
    pub id: String,
    /// 可读名称
    pub name: String,
    /// 功能描述（供 Swarm 调度器决策）
    pub description: String,
    /// 绑定的 LLM 模型标识
    pub model: String,
    /// ReAct 循环最大步数，超出后抛 `AgentError::MaxStepsExceeded`
    pub max_steps: u32,
}

// ─────────────────────────── 运行状态 ────────────────────────────────────────

/// Agent 生命周期状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    /// 空闲，等待任务
    Idle,
    /// 正在使用 LLM 进行推理规划
    Planning,
    /// 正在执行工具调用或技能
    Executing,
    /// 等待外部响应（用户确认、异步工具等）
    Waiting,
    /// 任务成功结束
    Completed,
    /// 任务失败，携带原因
    Failed(String),
}

// ─────────────────────────── 执行步骤 ────────────────────────────────────────

/// ReAct 单步记录（Thought → Action → Observation）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStep {
    /// 步骤序号（从 1 开始）
    pub step_id: u32,
    /// LLM 推理链文本（CoT）
    pub thought: Option<String>,
    /// 决定调用的工具/技能名称
    pub action: Option<String>,
    /// 传递给工具/技能的参数
    pub action_input: Option<serde_json::Value>,
    /// 工具/技能返回的原始结果
    pub observation: Option<serde_json::Value>,
}

// ─────────────────────────── 运行记录 ────────────────────────────────────────

/// 单次 `run()` 调用的执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunRecord {
    /// `run()` 返回的唯一 ID
    pub run_id: String,
    /// 提交的顶层目标
    pub goal: String,
    /// 最终状态
    pub status: AgentStatus,
    /// 完整步骤历史
    pub steps: Vec<AgentStep>,
    /// 最终输出（`Completed` 时填充）
    pub output: Option<serde_json::Value>,
}
