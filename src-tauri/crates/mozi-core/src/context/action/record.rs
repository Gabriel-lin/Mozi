#![allow(dead_code)]
use serde::{Deserialize, Serialize};

use super::types::{ActionKind, ActionOutcome};

/// 单条动作执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRecord {
    /// 全局唯一 ID
    pub id: String,
    /// 所属 ReAct 步骤 ID（与 `AgentStep.step_id` 对应）
    pub step_id: u32,
    /// 动作种类
    pub kind: ActionKind,
    /// 调用参数（JSON）
    pub params: serde_json::Value,
    /// 执行结果
    pub outcome: ActionOutcome,
    /// 开始执行的时间戳（Unix 毫秒）
    pub started_at_ms: u64,
    /// 完成执行的时间戳（`Pending` 时为 0）
    pub finished_at_ms: u64,
}

impl ActionRecord {
    /// 创建处于 `Pending` 状态的记录（动作开始时调用）
    pub fn start(step_id: u32, kind: ActionKind, params: serde_json::Value) -> Self {
        let now = now_ms();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            step_id,
            kind,
            params,
            outcome: ActionOutcome::Pending,
            started_at_ms: now,
            finished_at_ms: 0,
        }
    }

    /// 标记为成功（动作完成时调用）
    pub fn complete(&mut self, result: serde_json::Value) {
        self.outcome = ActionOutcome::Success(result);
        self.finished_at_ms = now_ms();
    }

    /// 标记为失败
    pub fn fail(&mut self, reason: impl Into<String>) {
        self.outcome = ActionOutcome::Failure(reason.into());
        self.finished_at_ms = now_ms();
    }

    /// 执行耗时（毫秒），`Pending` 时返回 0
    pub fn elapsed_ms(&self) -> u64 {
        if self.finished_at_ms == 0 {
            0
        } else {
            self.finished_at_ms.saturating_sub(self.started_at_ms)
        }
    }

    /// 是否已完成（成功或失败）
    pub fn is_done(&self) -> bool {
        !matches!(self.outcome, ActionOutcome::Pending)
    }
}

// ── 内部工具函数 ──────────────────────────────────────────────────────────────

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
