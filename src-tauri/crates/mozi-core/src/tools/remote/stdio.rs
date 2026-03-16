#![allow(dead_code)]
/// 远程工具：Stdio
///
/// 启动本地子进程，通过 stdin/stdout JSON-Lines 协议双向通信。
///
/// 协议约定（每行为一个完整 JSON 对象）：
///   - 请求：`{ "id": "...", "method": "tools/call", "params": { "name": "...", "arguments": {...} } }`
///   - 响应：`{ "id": "...", "result": {...} }` 或 `{ "id": "...", "error": {...} }`
///
/// 生命周期：
///   1. `register()` — spawn 子进程，握手发送 `initialize`
///   2. `call()`     — 发送 `tools/call`，立即返回 task_id
///   3. `cancel()`   — 仅标记任务状态（Pending 阶段可取消；Running 时子进程已执行）
///   4. `force_call()` — 直接同步发送并等待响应
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde_json::{json, Value};

use crate::tools::error::ToolError;
use crate::tools::registry::{
    new_task_id, new_task_store, TaskRecord, Tool, ToolMeta, ToolResult, ToolStatus,
};

use super::session::StdioSession;

pub struct StdioTool {
    meta: ToolMeta,
    command: String,
    args: Vec<String>,
    session: Arc<Mutex<Option<StdioSession>>>,
    tasks: Arc<Mutex<HashMap<String, TaskRecord>>>,
}

impl StdioTool {
    pub fn new(meta: ToolMeta, command: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            meta,
            command: command.into(),
            args,
            session: Arc::new(Mutex::new(None)),
            tasks: new_task_store(),
        }
    }

    fn send_recv(&self, request: &Value) -> Result<Value, ToolError> {
        self.session
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| ToolError::Stdio("Stdio 未连接，请先调用 register()".into()))?
            .send_recv(request)
    }
}

impl Tool for StdioTool {
    fn meta(&self) -> &ToolMeta {
        &self.meta
    }

    /// 重写：spawn 子进程，发送 `initialize` 握手
    fn register(&self) -> Result<(), ToolError> {
        let mut child = std::process::Command::new(&self.command)
            .args(&self.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| ToolError::Stdio(format!("启动子进程失败: {}", e)))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| ToolError::Stdio("无法获取 stdin".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| ToolError::Stdio("无法获取 stdout".into()))?;

        *self.session.lock().unwrap() = Some(StdioSession {
            stdin,
            reader: std::io::BufReader::new(stdout),
            _child: child,
        });

        let init = json!({ "id": new_task_id(), "method": "initialize", "params": {} });
        self.send_recv(&init)
            .map(|_| ())
            .map_err(|e| ToolError::Stdio(format!("初始化握手失败: {}", e)))
    }

    fn call(&self, params: Value) -> Result<String, ToolError> {
        let task_id = new_task_id();
        self.tasks
            .lock()
            .unwrap()
            .insert(task_id.clone(), TaskRecord::new(&task_id));

        let start = Instant::now();
        let req = json!({
            "id":     task_id,
            "method": "tools/call",
            "params": { "name": self.meta.id, "arguments": params }
        });
        let tasks = Arc::clone(&self.tasks);
        let tid = task_id.clone();

        match self.send_recv(&req) {
            Ok(output) => {
                let mut map = tasks.lock().unwrap();
                if let Some(rec) = map.get_mut(&tid) {
                    rec.status = ToolStatus::Completed;
                    rec.result = Some(ToolResult {
                        task_id: tid,
                        output,
                        status: ToolStatus::Completed,
                        elapsed_ms: start.elapsed().as_millis() as u64,
                    });
                }
            }
            Err(e) => {
                let mut map = tasks.lock().unwrap();
                if let Some(rec) = map.get_mut(&tid) {
                    rec.status = ToolStatus::Failed(e.to_string());
                }
            }
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
            Some(rec) if rec.status == ToolStatus::Pending || rec.status == ToolStatus::Running => {
                rec.status = ToolStatus::Cancelled;
                Ok(())
            }
            Some(_) => Err(ToolError::Cancelled(format!("任务 {} 已结束", task_id))),
            None => Err(ToolError::TaskNotFound(task_id.to_string())),
        }
    }

    fn force_call(&self, params: Value) -> Result<ToolResult, ToolError> {
        let start = Instant::now();
        let task_id = new_task_id();
        let req = json!({
            "id":     task_id,
            "method": "tools/call",
            "params": { "name": self.meta.id, "arguments": params }
        });
        let output = self.send_recv(&req)?;
        Ok(ToolResult {
            task_id,
            output,
            status: ToolStatus::Completed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }
}
