#![allow(dead_code)]
/// Stdio 进程会话
///
/// 封装子进程的 stdin 写端、stdout 读端及进程句柄。
/// 由 `StdioTool` 和 `McpTool` 共享使用。
///
/// Drop 时子进程句柄自动释放，OS 会向子进程发送 SIGTERM/关闭管道。
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout};

use serde_json::Value;

use crate::tools::error::ToolError;

pub(super) struct StdioSession {
    pub(super) stdin: ChildStdin,
    pub(super) reader: BufReader<ChildStdout>,
    /// 持有子进程句柄，保证进程在 session 存活期间不被 OS 回收
    pub(super) _child: Child,
}

impl StdioSession {
    /// 向子进程写入一行 JSON 请求，读取并返回一行 JSON 响应的 `result` 字段
    pub(super) fn send_recv(&mut self, request: &Value) -> Result<Value, ToolError> {
        // 写入请求（追加换行作为行分隔符）
        let line =
            serde_json::to_string(request).map_err(|e| ToolError::Serde(e.to_string()))? + "\n";

        self.stdin
            .write_all(line.as_bytes())
            .map_err(|e| ToolError::Stdio(format!("写入失败: {}", e)))?;
        self.stdin
            .flush()
            .map_err(|e| ToolError::Stdio(format!("flush 失败: {}", e)))?;

        // 读取响应
        let mut resp_line = String::new();
        self.reader
            .read_line(&mut resp_line)
            .map_err(|e| ToolError::Stdio(format!("读取失败: {}", e)))?;

        let resp: Value =
            serde_json::from_str(resp_line.trim()).map_err(|e| ToolError::Serde(e.to_string()))?;

        if let Some(err) = resp.get("error") {
            return Err(ToolError::Stdio(err.to_string()));
        }

        Ok(resp["result"].clone())
    }
}
