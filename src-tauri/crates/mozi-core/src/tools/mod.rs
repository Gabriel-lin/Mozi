#![allow(dead_code, unused_imports)]
/// 工具子系统入口
///
/// 模块结构：
/// ```
/// tools/
/// ├── mod.rs       ← 本文件：统一导出、全局 ToolStore 单例
/// ├── error.rs     ← 错误类型（ToolError）
/// ├── registry.rs  ← Tool Trait、ToolRegistrar Trait、ToolStore（标准实现）等核心定义
/// ├── adapter.rs   ← 协议适配器（OpenAI / Anthropic / MCP）
/// ├── buildin/     ← 内置工具（EchoTool、ShellTool 等）
/// └── remote/      ← 远程工具（RpcTool、StdioTool、McpTool）
/// ```
pub mod adapter;
pub mod buildin;
pub mod error;
pub mod registry;
pub mod remote;

use std::sync::{Arc, Mutex, OnceLock};

// ─────────────────────────── 全局工具仓库单例 ─────────────────────────────

static GLOBAL_STORE: OnceLock<Arc<Mutex<ToolStore>>> = OnceLock::new();

/// 获取全局工具仓库（懒初始化，自动注册所有内置工具）
pub fn global_store() -> Arc<Mutex<ToolStore>> {
    GLOBAL_STORE
        .get_or_init(|| {
            let mut store = ToolStore::new();
            buildin::register_all(&mut store).expect("内置工具注册失败");
            Arc::new(Mutex::new(store))
        })
        .clone()
}

/// 公开 re-export，方便其他模块直接使用核心类型
pub use error::ToolError;
pub use registry::{
    Tool, ToolCategory, ToolContext, ToolMeta, ToolRegistrar, ToolResult, ToolStatus, ToolStore,
    ToolType,
};
