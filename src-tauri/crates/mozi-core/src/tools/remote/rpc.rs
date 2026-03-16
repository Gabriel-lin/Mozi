#![allow(dead_code)]
/// 远程工具：RPC
///
/// 通过 HTTP JSON-RPC 2.0 调用远程工具端点。
///
/// 生命周期：
///   1. `register()` — 向 endpoint 发送 `tools/list`，验证连通性并置为 Connected
///   2. `call()`     — 发送 `tools/call`，立即返回 task_id，结果写入任务记录
///   3. `status()` / `result()` — 轮询任务状态与结果
///   4. `cancel()`   — 标记任务为 Cancelled（RPC 本身无取消机制）
///   5. `force_call()` — 跳过状态检查，直接同步执行
///
/// > 当前使用 `curl` 作为轻量 HTTP 客户端；生产环境应替换为 `reqwest::blocking`。
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde_json::{json, Value};

use crate::tools::error::ToolError;
use crate::tools::registry::{
    new_task_id, new_task_store, TaskRecord, Tool, ToolMeta, ToolResult, ToolStatus,
};

// ── 连接状态（仅 RpcTool 内部使用） ──────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
enum ConnectionState {
    Disconnected,
    Connected,
    Failed(String),
}

// ── RpcTool ───────────────────────────────────────────────────────────────

pub struct RpcTool {
    meta: ToolMeta,
    endpoint: String,
    tasks: Arc<Mutex<HashMap<String, TaskRecord>>>,
    state: Arc<Mutex<ConnectionState>>,
}

impl RpcTool {
    /// 创建 RPC 工具
    ///
    /// - `meta`     — 工具元数据
    /// - `endpoint` — JSON-RPC 服务地址，例如 `http://127.0.0.1:8080/rpc`
    pub fn new(meta: ToolMeta, endpoint: impl Into<String>) -> Self {
        Self {
            meta,
            endpoint: endpoint.into(),
            tasks: new_task_store(),
            state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
        }
    }

    /// 同步执行一次 JSON-RPC 请求（阻塞，内部复用于 register / call / force_call）
    fn invoke_sync(&self, method: &str, params: Value) -> Result<Value, ToolError> {
        let body = json!({
            "jsonrpc": "2.0",
            "id":      new_task_id(),
            "method":  method,
            "params":  params,
        });

        let output = std::process::Command::new("curl")
            .args([
                "-s",
                "-X",
                "POST",
                "-H",
                "Content-Type: application/json",
                "-d",
                &body.to_string(),
                &self.endpoint,
            ])
            .output()
            .map_err(|e| ToolError::Rpc(format!("curl 失败: {}", e)))?;

        let resp_str = String::from_utf8_lossy(&output.stdout);
        let resp: Value =
            serde_json::from_str(&resp_str).map_err(|e| ToolError::Serde(e.to_string()))?;

        if let Some(err) = resp.get("error") {
            return Err(ToolError::Rpc(err.to_string()));
        }

        Ok(resp["result"].clone())
    }
}

impl Tool for RpcTool {
    fn meta(&self) -> &ToolMeta {
        &self.meta
    }

    /// 重写：发送 `tools/list` 验证连通性，成功后置为 Connected
    fn register(&self) -> Result<(), ToolError> {
        match self.invoke_sync("tools/list", json!({})) {
            Ok(_) => {
                *self.state.lock().unwrap() = ConnectionState::Connected;
                Ok(())
            }
            Err(e) => {
                let msg = e.to_string();
                *self.state.lock().unwrap() = ConnectionState::Failed(msg.clone());
                Err(ToolError::Rpc(format!("RPC 注册失败: {}", msg)))
            }
        }
    }

    fn call(&self, params: Value) -> Result<String, ToolError> {
        if *self.state.lock().unwrap() != ConnectionState::Connected {
            return Err(ToolError::Rpc("工具未连接，请先调用 register()".into()));
        }

        let task_id = new_task_id();
        self.tasks
            .lock()
            .unwrap()
            .insert(task_id.clone(), TaskRecord::new(&task_id));

        let start = Instant::now();
        let call_params = json!({ "name": self.meta.id, "arguments": params });
        let tasks = Arc::clone(&self.tasks);
        let tid = task_id.clone();

        match self.invoke_sync("tools/call", call_params) {
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
        let output = self.invoke_sync(
            "tools/call",
            json!({ "name": self.meta.id, "arguments": params }),
        )?;
        Ok(ToolResult {
            task_id: new_task_id(),
            output,
            status: ToolStatus::Completed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }
}
