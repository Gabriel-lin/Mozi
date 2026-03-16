#![allow(dead_code)]
use serde::{Deserialize, Serialize};

use super::record::ActionRecord;
use super::types::ActionOutcome;

/// 行动历史记录仓库
///
/// 存储当前 Agent/Session 中所有已执行动作的记录，
/// 供策略层回顾、RAG 摘要及审计日志使用。
#[derive(Debug, Default)]
pub struct ActionHistory {
    records: Vec<ActionRecord>,
}

impl ActionHistory {
    pub fn new() -> Self {
        Self::default()
    }

    // ── 写入 ──────────────────────────────────────────────────────────────

    /// 追加记录
    pub fn push(&mut self, record: ActionRecord) {
        self.records.push(record);
    }

    /// 按 ID 获取可变引用（用于更新 `outcome`）
    pub fn get_mut(&mut self, id: &str) -> Option<&mut ActionRecord> {
        self.records.iter_mut().find(|r| r.id == id)
    }

    // ── 查询 ──────────────────────────────────────────────────────────────

    /// 按 ID 只读查找
    pub fn get(&self, id: &str) -> Option<&ActionRecord> {
        self.records.iter().find(|r| r.id == id)
    }

    /// 返回指定步骤的所有动作记录
    pub fn by_step(&self, step_id: u32) -> Vec<&ActionRecord> {
        self.records
            .iter()
            .filter(|r| r.step_id == step_id)
            .collect()
    }

    /// 返回失败的动作记录列表
    pub fn failures(&self) -> Vec<&ActionRecord> {
        self.records
            .iter()
            .filter(|r| matches!(r.outcome, ActionOutcome::Failure(_)))
            .collect()
    }

    /// 返回成功的动作记录列表
    pub fn successes(&self) -> Vec<&ActionRecord> {
        self.records
            .iter()
            .filter(|r| matches!(r.outcome, ActionOutcome::Success(_)))
            .collect()
    }

    /// 返回尚未完成的动作记录列表
    pub fn pending(&self) -> Vec<&ActionRecord> {
        self.records
            .iter()
            .filter(|r| matches!(r.outcome, ActionOutcome::Pending))
            .collect()
    }

    /// 统计成功 / 失败 / 等待数量
    pub fn summary(&self) -> ActionSummary {
        let mut s = ActionSummary::default();
        for r in &self.records {
            match &r.outcome {
                ActionOutcome::Success(_) => s.success += 1,
                ActionOutcome::Failure(_) => s.failure += 1,
                ActionOutcome::Pending => s.pending += 1,
            }
        }
        s
    }

    /// 清空历史（新 `run()` 开始前调用）
    pub fn clear(&mut self) {
        self.records.clear();
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    /// 返回全部记录的只读切片
    pub fn all(&self) -> &[ActionRecord] {
        &self.records
    }
}

/// 动作历史统计摘要
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ActionSummary {
    pub success: u32,
    pub failure: u32,
    pub pending: u32,
}
