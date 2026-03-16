#![allow(dead_code)]
//! # ContextWindow
//!
//! Agent 运行时上下文窗口：维护有界滑动窗口存储 `ContextEntry`，
//! 同时内嵌 `ToolStore` 以支持 context 级工具注册（`ToolRegistrar`）。

use std::collections::VecDeque;
use std::sync::Arc;

use crate::tools::registry::{Tool, ToolCategory, ToolMeta, ToolRegistrar, ToolStore, ToolType};
use crate::tools::ToolError;

use super::types::{ContextEntry, ContextSource};

// ─────────────────────────── ContextWindow ───────────────────────────────────

/// Agent 运行时上下文窗口
///
/// 有界滑动窗口：超出 `capacity` 时自动丢弃最旧条目（FIFO）。
/// 通过委托内嵌 `ToolStore` 实现 `ToolRegistrar`，使 context 级工具
/// 可在当前会话内直接调用，无需挂载到 Agent 的全局工具集。
#[derive(Debug)]
pub struct ContextWindow {
    entries: VecDeque<ContextEntry>,
    capacity: usize,
    /// context 级工具仓库（委托 ToolRegistrar 实现）
    tool_store: ToolStore,
}

impl ContextWindow {
    /// 创建指定容量的上下文窗口
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: VecDeque::with_capacity(capacity),
            capacity,
            tool_store: ToolStore::new(),
        }
    }

    // ── 条目写入 ──────────────────────────────────────────────────────────

    /// 追加条目；超出容量时移除最旧条目
    pub fn push(&mut self, entry: ContextEntry) {
        if self.entries.len() >= self.capacity {
            self.entries.pop_front();
        }
        self.entries.push_back(entry);
    }

    // ── 条目查询 ──────────────────────────────────────────────────────────

    /// 按来源筛选（返回引用切片）
    pub fn filter_by_source(&self, source: &ContextSource) -> Vec<&ContextEntry> {
        self.entries
            .iter()
            .filter(|e| &e.source == source)
            .collect()
    }

    /// 返回最近 `n` 条条目（从新到旧）
    pub fn recent(&self, n: usize) -> Vec<&ContextEntry> {
        self.entries.iter().rev().take(n).collect()
    }

    /// 按 ID 查找条目
    pub fn get_by_id(&self, id: &str) -> Option<&ContextEntry> {
        self.entries.iter().find(|e| e.id == id)
    }

    /// 返回时间戳在 `[from_ms, to_ms]` 范围内的条目
    pub fn range(&self, from_ms: u64, to_ms: u64) -> Vec<&ContextEntry> {
        self.entries
            .iter()
            .filter(|e| e.timestamp_ms >= from_ms && e.timestamp_ms <= to_ms)
            .collect()
    }

    // ── 容量管理 ──────────────────────────────────────────────────────────

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// 清空所有条目（不重置 capacity）
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// 动态调整容量（缩小时从头部丢弃超出条目）
    pub fn resize(&mut self, new_capacity: usize) {
        while self.entries.len() > new_capacity {
            self.entries.pop_front();
        }
        self.capacity = new_capacity;
    }
}

// ── ToolRegistrar（委托给内部 ToolStore） ─────────────────────────────────────

impl ToolRegistrar for ContextWindow {
    fn register_tool(&mut self, tool: Arc<dyn Tool>) -> Result<(), ToolError> {
        self.tool_store.register_tool(tool)
    }
    fn unregister_tool(&mut self, id: &str) -> Result<(), ToolError> {
        self.tool_store.unregister_tool(id)
    }
    fn get_tool(&self, id: &str) -> Option<Arc<dyn Tool>> {
        self.tool_store.get_tool(id)
    }
    fn list_tools(&self) -> Vec<ToolMeta> {
        self.tool_store.list_tools()
    }
    fn list_tools_by_category(&self, category: &ToolCategory) -> Vec<ToolMeta> {
        self.tool_store.list_tools_by_category(category)
    }
    fn list_tools_by_type(&self, tool_type: &ToolType) -> Vec<ToolMeta> {
        self.tool_store.list_tools_by_type(tool_type)
    }
}
