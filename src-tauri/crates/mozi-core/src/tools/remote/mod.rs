#![allow(dead_code, unused_imports)]
/// 远程工具模块
///
/// 支持通过三种协议调用外部工具：
///
/// | 子模块   | 协议          | 传输方式                        | 适用场景              |
/// |---------|---------------|---------------------------------|-----------------------|
/// | `rpc`   | HTTP JSON-RPC 2.0 | curl / reqwest              | 微服务、远程 API      |
/// | `stdio` | JSON-Lines    | 子进程 stdin/stdout              | 本地语言工具（Python/Node）|
/// | `mcp`   | MCP 2024-11-05 | 子进程 stdin/stdout (JSON-RPC)  | MCP Server 生态工具   |
///
/// 所有远程工具共同约定：
///   - **重写** `register()` 建立连接/握手，失败时应返回具体协议错误
///   - `call()` 立即返回 task_id，实际执行在当前线程同步完成后写入任务记录
///   - `force_call()` 跳过任务队列，直接同步执行并返回结果
mod session;

pub mod mcp;
pub mod rpc;
pub mod stdio;

use serde::{Deserialize, Serialize};

pub use mcp::McpTool;
pub use rpc::RpcTool;
pub use stdio::StdioTool;

// ─────────────────────────── 远程协议类型枚举 ────────────────────────────

/// 远程工具使用的底层传输协议描述
///
/// 可用于序列化配置文件，或在运行时动态选择适合的工具实现。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RemoteProtocol {
    /// HTTP JSON-RPC 2.0
    Rpc { endpoint: String },
    /// 子进程 stdin/stdout JSON-Lines
    Stdio { command: String, args: Vec<String> },
    /// Model Context Protocol（Stdio 传输）
    Mcp { command: String, args: Vec<String> },
}
