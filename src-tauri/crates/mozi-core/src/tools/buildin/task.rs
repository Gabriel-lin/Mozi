#![allow(dead_code)]
/// 内置工具任务状态管理辅助函数
///
/// 所有内置工具共享同一套任务记录模式：
///   1. `start_task`  — 创建 Pending 记录，返回 task_id
///   2. `finish_task` — 写入结果，状态置为 Completed
///   3. `fail_task`   — 写入错误原因，状态置为 Failed
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::tools::registry::{new_task_id, TaskRecord, ToolResult, ToolStatus};

/// 创建新任务记录（Pending 状态），返回 task_id
pub(super) fn start_task(store: &Arc<Mutex<HashMap<String, TaskRecord>>>) -> String {
    let task_id = new_task_id();
    store
        .lock()
        .unwrap()
        .insert(task_id.clone(), TaskRecord::new(&task_id));
    task_id
}

/// 写入执行结果，将任务状态更新为 Completed
pub(super) fn finish_task(
    store: &Arc<Mutex<HashMap<String, TaskRecord>>>,
    task_id: &str,
    result: ToolResult,
) {
    let mut map = store.lock().unwrap();
    if let Some(rec) = map.get_mut(task_id) {
        rec.status = result.status.clone();
        rec.result = Some(result);
        rec.updated_at = Instant::now();
    }
}

/// 写入错误原因，将任务状态更新为 Failed
pub(super) fn fail_task(store: &Arc<Mutex<HashMap<String, TaskRecord>>>, task_id: &str, err: &str) {
    let mut map = store.lock().unwrap();
    if let Some(rec) = map.get_mut(task_id) {
        rec.status = ToolStatus::Failed(err.to_string());
        rec.updated_at = Instant::now();
    }
}
