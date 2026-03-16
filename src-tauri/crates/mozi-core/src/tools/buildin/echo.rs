#![allow(dead_code)]
/// 内置工具：Echo
///
/// 原样返回输入的 `message` 字段，用于调试、管道测试和工具链验证。
///
/// 输入 schema：
/// ```json
/// { "message": "<string>" }
/// ```
/// 输出 schema：
/// ```json
/// { "message": "<string>" }
/// ```
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde_json::{json, Value};

use crate::tools::error::ToolError;
use crate::tools::registry::{
    new_task_id, new_task_store, TaskRecord, Tool, ToolCategory, ToolMeta, ToolResult, ToolStatus,
    ToolType,
};

use super::task::{fail_task, finish_task, start_task};

pub struct EchoTool {
    meta: ToolMeta,
    tasks: Arc<Mutex<HashMap<String, TaskRecord>>>,
}

impl EchoTool {
    pub fn new() -> Self {
        Self {
            meta: ToolMeta {
                id: "buildin.echo".to_string(),
                name: "Echo".to_string(),
                description: "原样返回输入参数，用于调试和管道测试。".to_string(),
                version: "0.1.0".to_string(),
                tool_type: ToolType::Buildin,
                category: ToolCategory::Log,
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "message": { "type": "string", "description": "要回显的消息" }
                    },
                    "required": ["message"]
                }),
                output_schema: json!({
                    "type": "object",
                    "properties": {
                        "message": { "type": "string" }
                    }
                }),
            },
            tasks: new_task_store(),
        }
    }
}

impl Default for EchoTool {
    fn default() -> Self {
        Self::new()
    }
}

impl Tool for EchoTool {
    fn meta(&self) -> &ToolMeta {
        &self.meta
    }

    fn call(&self, params: Value) -> Result<String, ToolError> {
        let task_id = start_task(&self.tasks);
        let start = Instant::now();

        let message = params["message"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 message 字段".into()))?
            .to_string();

        let result = ToolResult {
            task_id: task_id.clone(),
            output: json!({ "message": message }),
            status: ToolStatus::Completed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        };

        finish_task(&self.tasks, &task_id, result);
        Ok(task_id)
    }

    fn status(&self, task_id: &str) -> ToolStatus {
        self.tasks
            .lock()
            .unwrap()
            .get(task_id)
            .map(|r| r.status.clone())
            .unwrap_or(ToolStatus::Idle)
    }

    fn result(&self, task_id: &str) -> Option<ToolResult> {
        self.tasks
            .lock()
            .unwrap()
            .get(task_id)
            .and_then(|r| r.result.clone())
    }

    fn cancel(&self, task_id: &str) -> Result<(), ToolError> {
        let mut map = self.tasks.lock().unwrap();
        match map.get_mut(task_id) {
            Some(rec) if rec.status == ToolStatus::Pending || rec.status == ToolStatus::Running => {
                rec.status = ToolStatus::Cancelled;
                Ok(())
            }
            Some(_) => Err(ToolError::Cancelled(format!(
                "任务 {} 已处于终止状态，无法取消",
                task_id
            ))),
            None => Err(ToolError::TaskNotFound(task_id.to_string())),
        }
    }

    fn force_call(&self, params: Value) -> Result<ToolResult, ToolError> {
        let start = Instant::now();
        let message = params["message"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 message 字段".into()))?
            .to_string();
        Ok(ToolResult {
            task_id: new_task_id(),
            output: json!({ "message": message }),
            status: ToolStatus::Completed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }
}
