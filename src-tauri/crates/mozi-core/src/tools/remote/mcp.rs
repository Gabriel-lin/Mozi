#![allow(dead_code)]
/// 远程工具：MCP（Model Context Protocol）
///
/// 遵循 MCP 规范 2024-11-05，通过 Stdio 传输与 MCP Server 通信。
///
/// 生命周期：
///   1. `register()` — spawn MCP Server 子进程，依次完成：
///        a. `initialize` 握手（协商协议版本与能力）
///        b. `tools/list` 拉取服务端声明的工具列表（写入 `available_tools`）
///   2. `call()`     — 发送 `tools/call`，立即返回 task_id
///   3. `cancel()`   — 发送 `notifications/cancelled` 通知 Server，并标记任务状态
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

pub struct McpTool {
    meta: ToolMeta,
    server_command: String,
    server_args: Vec<String>,
    session: Arc<Mutex<Option<StdioSession>>>,
    tasks: Arc<Mutex<HashMap<String, TaskRecord>>>,
    /// 注册成功后，缓存 MCP Server 声明的可用工具列表
    available_tools: Arc<Mutex<Vec<Value>>>,
}

impl McpTool {
    pub fn new(
        meta: ToolMeta,
        server_command: impl Into<String>,
        server_args: Vec<String>,
    ) -> Self {
        Self {
            meta,
            server_command: server_command.into(),
            server_args,
            session: Arc::new(Mutex::new(None)),
            tasks: new_task_store(),
            available_tools: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 返回注册后缓存的服务端工具列表
    pub fn available_tools(&self) -> Vec<Value> {
        self.available_tools.lock().unwrap().clone()
    }

    fn send_recv(&self, request: &Value) -> Result<Value, ToolError> {
        self.session
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| ToolError::Mcp("MCP 未连接，请先调用 register()".into()))?
            .send_recv(request)
            // StdioSession::send_recv 返回 Stdio 错误，此处统一转为 Mcp 错误
            .map_err(|e| match e {
                ToolError::Stdio(msg) => ToolError::Mcp(msg),
                other => other,
            })
    }
}

impl Tool for McpTool {
    fn meta(&self) -> &ToolMeta {
        &self.meta
    }

    /// 重写：spawn MCP Server → initialize 握手 → tools/list 拉取工具列表
    fn register(&self) -> Result<(), ToolError> {
        let mut child = std::process::Command::new(&self.server_command)
            .args(&self.server_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| ToolError::Mcp(format!("启动 MCP Server 失败: {}", e)))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| ToolError::Mcp("无法获取 stdin".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| ToolError::Mcp("无法获取 stdout".into()))?;

        *self.session.lock().unwrap() = Some(StdioSession {
            stdin,
            reader: std::io::BufReader::new(stdout),
            _child: child,
        });

        // Step 1: initialize
        let init = json!({
            "jsonrpc": "2.0",
            "id":      new_task_id(),
            "method":  "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities":    { "tools": {} },
                "clientInfo":      { "name": "mozi", "version": "0.1.0" }
            }
        });
        self.send_recv(&init)
            .map_err(|e| ToolError::Mcp(format!("initialize 失败: {}", e)))?;

        // Step 2: tools/list — 缓存服务端声明的工具
        let list_resp = self
            .send_recv(&json!({
                "jsonrpc": "2.0",
                "id":      new_task_id(),
                "method":  "tools/list",
                "params":  {}
            }))
            .map_err(|e| ToolError::Mcp(format!("tools/list 失败: {}", e)))?;

        if let Some(tools) = list_resp["tools"].as_array() {
            *self.available_tools.lock().unwrap() = tools.clone();
        }

        Ok(())
    }

    fn call(&self, params: Value) -> Result<String, ToolError> {
        let task_id = new_task_id();
        self.tasks
            .lock()
            .unwrap()
            .insert(task_id.clone(), TaskRecord::new(&task_id));

        let start = Instant::now();
        let req = json!({
            "jsonrpc": "2.0",
            "id":      task_id,
            "method":  "tools/call",
            "params":  { "name": self.meta.id, "arguments": params }
        });
        let tasks = Arc::clone(&self.tasks);
        let tid = task_id.clone();

        match self.send_recv(&req) {
            Ok(resp) => {
                // MCP content 字段是数组；优先取 content，否则用整个 resp
                let output = resp.get("content").cloned().unwrap_or(resp);
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
        // MCP 协议通过 notifications/cancelled 通知 Server 取消请求
        let _ = self.send_recv(&json!({
            "jsonrpc": "2.0",
            "method":  "notifications/cancelled",
            "params":  { "requestId": task_id, "reason": "user_cancelled" }
        }));

        let mut map = self.tasks.lock().unwrap();
        match map.get_mut(task_id) {
            Some(rec) => {
                rec.status = ToolStatus::Cancelled;
                Ok(())
            }
            None => Err(ToolError::TaskNotFound(task_id.to_string())),
        }
    }

    fn force_call(&self, params: Value) -> Result<ToolResult, ToolError> {
        let start = Instant::now();
        let task_id = new_task_id();
        let resp = self.send_recv(&json!({
            "jsonrpc": "2.0",
            "id":      task_id,
            "method":  "tools/call",
            "params":  { "name": self.meta.id, "arguments": params }
        }))?;
        let output = resp.get("content").cloned().unwrap_or(resp);
        Ok(ToolResult {
            task_id,
            output,
            status: ToolStatus::Completed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }
}
