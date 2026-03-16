#![allow(dead_code)]
//! # ReAct 引擎
//!
//! 实现 **Reason + Act** 循环，供各类具体 Agent 复用：
//!
//! ```text
//! ┌──────────────────────────────────────────────────┐
//! │  goal                                            │
//! │    │                                             │
//! │    ▼                                             │
//! │  [Thought]  ←── LLM 推理（CoT / scratchpad）     │
//! │    │                                             │
//! │    ▼                                             │
//! │  [Action]   ←── 解析工具/技能调用意图              │
//! │    │                                             │
//! │    ▼                                             │
//! │  [Observation] ←── 执行并收集结果                  │
//! │    │                                             │
//! │    └──► 写入 ContextWindow → 下一步 Thought       │
//! └──────────────────────────────────────────────────┘
//! ```
//!
//! 各具体 Agent 仅需提供：
//!  - `think(&context) -> Thought`：调用 LLM 产生推理链
//!  - `act(&thought) -> ActionRequest`：将推理转化为工具/技能调用描述
//!  - `observe(&action_result) -> Observation`：整理执行结果
//!
//! 循环控制（`max_steps`、终止判断、错误处理）由 `ReActEngine` 统一管理。

use serde::{Deserialize, Serialize};

use crate::errors::AgentError;

use super::types::AgentStep;

// ─────────────────────────── 推理结果 ────────────────────────────────────────

/// LLM 推理输出
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thought {
    /// CoT 推理文本（供调试/记录）
    pub reasoning: String,
    /// 是否判断任务已完成（最终答案）
    pub is_final: bool,
    /// 若非最终，解析出的下一步动作意图
    pub next_action: Option<ActionIntent>,
}

/// 动作意图（由 LLM 输出解析而来，尚未执行）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionIntent {
    /// 工具或技能的 ID
    pub target_id: String,
    /// 调用参数（JSON）
    pub params: serde_json::Value,
}

// ─────────────────────────── 动作请求与结果 ──────────────────────────────────

/// 实际执行的动作请求（由 `ActionIntent` 派生）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub target_id: String,
    pub params: serde_json::Value,
}

/// 动作执行结果（工具/技能返回值）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub target_id: String,
    pub output: serde_json::Value,
    pub success: bool,
    pub error: Option<String>,
}

// ─────────────────────────── ReAct 引擎 ──────────────────────────────────────

/// ReAct 循环引擎
///
/// 持有状态机所需的全部运行时数据；具体 Agent 通过组合此结构体
/// 并实现三个钩子方法（`think` / `act` / `observe`）来驱动循环。
pub struct ReActEngine {
    /// 当前步骤序号（从 1 开始）
    current_step: u32,
    /// 来自 `AgentMeta` 的最大步数限制
    max_steps: u32,
    /// 已完成的步骤历史
    steps: Vec<AgentStep>,
    /// 是否已收到最终答案信号
    finished: bool,
}

impl ReActEngine {
    /// 创建新的 ReAct 引擎
    pub fn new(max_steps: u32) -> Self {
        Self {
            current_step: 0,
            max_steps,
            steps: Vec::new(),
            finished: false,
        }
    }

    /// 是否已终止（完成或达到步数上限）
    pub fn is_done(&self) -> bool {
        self.finished || self.current_step >= self.max_steps
    }

    /// 记录一步并推进计数器
    ///
    /// 由具体 Agent 在完成 Thought-Action-Observation 三段后调用。
    pub fn record_step(&mut self, step: AgentStep) -> Result<(), AgentError> {
        if self.is_done() {
            return Err(AgentError::MaxStepsExceeded(format!(
                "已达到最大步数 {}",
                self.max_steps
            )));
        }
        self.current_step += 1;
        self.steps.push(step);
        Ok(())
    }

    /// 标记循环已达到最终答案，外层 Agent 应将 status 切换为 Completed
    pub fn mark_finished(&mut self) {
        self.finished = true;
    }

    /// 返回步骤历史切片
    pub fn steps(&self) -> &[AgentStep] {
        &self.steps
    }

    /// 当前步骤序号
    pub fn current_step(&self) -> u32 {
        self.current_step
    }

    /// 重置引擎（新的 `run()` 调用前使用）
    pub fn reset(&mut self) {
        self.current_step = 0;
        self.steps.clear();
        self.finished = false;
    }
}
