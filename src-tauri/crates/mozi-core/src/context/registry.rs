#![allow(dead_code)]
use crate::errors::ContextError;

use super::window::ContextWindow;

// ─────────────────────────── ContextRegistrar Trait ──────────────────────────

/// 上下文注册器 Trait
///
/// 任何可以**持有并绑定 `ContextWindow`** 的主体（Agent、Swarm）实现此接口。
///
/// ```text
/// Agent / Swarm
///  └──(ContextRegistrar)──► ContextWindow
///                              ├── ContextEntry[]  (感知/行动历史)
///                              └── ToolStore       (context 级工具)
/// ```
///
/// 绑定后，主体可通过 `context_mut()` 向窗口写入新条目或注册工具。
pub trait ContextRegistrar: Send + Sync {
    /// 绑定上下文窗口（替换旧的，若存在）
    fn attach_context(&mut self, ctx: ContextWindow) -> Result<(), ContextError>;

    /// 解绑并丢弃当前上下文窗口
    ///
    /// 窗口不存在时返回 `ContextError::NotAttached`。
    fn detach_context(&mut self) -> Result<(), ContextError>;

    /// 只读访问当前上下文（无窗口时返回 `None`）
    fn context(&self) -> Option<&ContextWindow>;

    /// 可变访问当前上下文（用于写入条目或注册工具）
    fn context_mut(&mut self) -> Option<&mut ContextWindow>;

    /// 判断是否已绑定上下文
    fn has_context(&self) -> bool {
        self.context().is_some()
    }
}
