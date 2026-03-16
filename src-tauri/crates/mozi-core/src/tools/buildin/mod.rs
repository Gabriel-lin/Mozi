#![allow(dead_code, unused_imports)]
/// 内置工具模块
///
/// 内置工具随应用一同打包，使用 Rust 原生实现，不依赖外部进程或网络连接。
///
/// 子模块：
/// - `task`   ← 共享任务辅助函数（start_task / finish_task / fail_task）
/// - `echo`   ← EchoTool：原样返回输入，用于调试和管道测试
/// - `shell`  ← ShellTool：执行本地 Shell 命令，返回 stdout/stderr/exit_code
///
/// 所有内置工具的共同约定：
///   - `register()` 使用默认实现，返回 `Ok(())`，无需额外初始化
///   - 内部以 `Arc<Mutex<HashMap<String, TaskRecord>>>` 管理异步任务状态
///   - `force_call()` 绕过任务队列，直接同步执行
mod task;

pub mod echo;
pub mod shell;

use std::sync::Arc;

use crate::tools::error::ToolError;
use crate::tools::registry::ToolRegistrar;

pub use echo::EchoTool;
pub use shell::ShellTool;

/// 将所有内置工具批量注册到任意 `ToolRegistrar` 实现
///
/// 接受 `&mut dyn ToolRegistrar`，因此可以直接注册进
/// `ToolStore`、`ContextWindow`、具体 `Agent` 等任何持有工具的主体。
pub fn register_all(store: &mut dyn ToolRegistrar) -> Result<(), ToolError> {
    store.register_tool(Arc::new(EchoTool::new()))?;
    store.register_tool(Arc::new(ShellTool::new()))?;
    Ok(())
}
