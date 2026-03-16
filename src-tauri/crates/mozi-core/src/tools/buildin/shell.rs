#![allow(dead_code)]
/// 内置工具：Shell
///
/// 在本地通过 `sh -c` 执行任意 Shell 命令，返回 stdout、stderr 和退出码。
///
/// 输入 schema：
/// ```json
/// {
///   "command": "<string>",       // 必填：要执行的命令
///   "cwd":     "<string>",       // 可选：工作目录
///   "timeout_secs": <integer>    // 可选：超时秒数（默认 30）
/// }
/// ```
/// 输出 schema：
/// ```json
/// { "stdout": "<string>", "stderr": "<string>", "exit_code": <integer> }
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

pub struct ShellTool {
    meta: ToolMeta,
    tasks: Arc<Mutex<HashMap<String, TaskRecord>>>,
}

impl ShellTool {
    pub fn new() -> Self {
        Self {
            meta: ToolMeta {
                id: "buildin.shell".to_string(),
                name: "Shell".to_string(),
                description: "在本地执行 Shell 命令，返回 stdout、stderr 和退出码。".to_string(),
                version: "0.1.0".to_string(),
                tool_type: ToolType::Buildin,
                category: ToolCategory::Shell,
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "command":      { "type": "string",  "description": "要执行的 Shell 命令" },
                        "cwd":          { "type": "string",  "description": "工作目录（可选）" },
                        "timeout_secs": { "type": "integer", "description": "超时秒数，默认 30" }
                    },
                    "required": ["command"]
                }),
                output_schema: json!({
                    "type": "object",
                    "properties": {
                        "stdout":    { "type": "string"  },
                        "stderr":    { "type": "string"  },
                        "exit_code": { "type": "integer" }
                    }
                }),
            },
            tasks: new_task_store(),
        }
    }

    /// 同步执行命令，返回结构化输出（内部复用于 call / force_call）
    fn execute(params: &Value) -> Result<Value, ToolError> {
        let command = params["command"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParams("缺少 command 字段".into()))?;

        let mut cmd = std::process::Command::new("sh");
        cmd.args(["-c", command]);

        if let Some(cwd) = params["cwd"].as_str() {
            cmd.current_dir(cwd);
        }

        let output = cmd
            .output()
            .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;

        Ok(json!({
            "stdout":    String::from_utf8_lossy(&output.stdout).to_string(),
            "stderr":    String::from_utf8_lossy(&output.stderr).to_string(),
            "exit_code": output.status.code().unwrap_or(-1),
        }))
    }
}

impl Default for ShellTool {
    fn default() -> Self {
        Self::new()
    }
}

impl Tool for ShellTool {
    fn meta(&self) -> &ToolMeta {
        &self.meta
    }

    fn call(&self, params: Value) -> Result<String, ToolError> {
        let task_id = start_task(&self.tasks);
        let start = Instant::now();

        match Self::execute(&params) {
            Ok(output) => finish_task(
                &self.tasks,
                &task_id,
                ToolResult {
                    task_id: task_id.clone(),
                    output,
                    status: ToolStatus::Completed,
                    elapsed_ms: start.elapsed().as_millis() as u64,
                },
            ),
            Err(e) => fail_task(&self.tasks, &task_id, &e.to_string()),
        }

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
            Some(rec) if rec.status == ToolStatus::Pending => {
                rec.status = ToolStatus::Cancelled;
                Ok(())
            }
            Some(_) => Err(ToolError::Cancelled(format!(
                "Shell 任务 {} 正在执行中，无法取消",
                task_id
            ))),
            None => Err(ToolError::TaskNotFound(task_id.to_string())),
        }
    }

    fn force_call(&self, params: Value) -> Result<ToolResult, ToolError> {
        let start = Instant::now();
        let output = Self::execute(&params)?;
        Ok(ToolResult {
            task_id: new_task_id(),
            output,
            status: ToolStatus::Completed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }
}
