#![allow(dead_code, unused_imports)]
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::ToolError;

// ─────────────────────────── 枚举：工具类型 ───────────────────────────────

/// 工具来源类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolType {
    /// 内置工具（随应用打包，Rust 原生实现）
    Buildin,
    /// 远程工具（通过 RPC / Stdio / MCP 协议调用外部进程或服务）
    Remote,
}

// ─────────────────────────── 枚举：工具类别 ───────────────────────────────

/// 工具功能分类
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    /// 文件系统操作
    Fs,
    /// Shell / 命令行执行
    Shell,
    /// HTTP 网络请求
    Fetch,
    /// 语言模型推理
    Llm,
    /// 信息抽取
    InfoExtraction,
    /// 日志记录
    Log,
    /// 用户交互询问
    AskUser,
    /// 沙箱隔离执行
    Sandbox,
    /// 消息通道
    MessageChannel,
    /// 音频处理
    Sound,
    /// 视觉/图像处理
    Visual,
    /// 自定义类别
    Custom(String),
}

// ─────────────────────────── 工具元数据 ──────────────────────────────────

/// 工具的静态定义信息（不可变）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMeta {
    /// 全局唯一 ID（建议格式：`category.name`，如 `fs.read_file`）
    pub id: String,
    /// 人类可读名称
    pub name: String,
    /// 功能描述（用于 LLM 工具选择）
    pub description: String,
    /// 语义化版本号
    pub version: String,
    /// 工具来源类型
    pub tool_type: ToolType,
    /// 功能类别
    pub category: ToolCategory,
    /// 输入参数的 JSON Schema（用于参数校验与文档生成）
    pub input_schema: serde_json::Value,
    /// 输出结果的 JSON Schema
    pub output_schema: serde_json::Value,
}

// ─────────────────────────── 任务状态 ────────────────────────────────────

/// 工具任务的执行状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolStatus {
    /// 空闲，尚未提交任务
    Idle,
    /// 任务已提交，等待执行
    Pending,
    /// 正在执行中
    Running,
    /// 执行成功完成
    Completed,
    /// 执行失败，携带错误信息
    Failed(String),
    /// 任务被主动取消
    Cancelled,
}

// ─────────────────────────── 执行结果 ────────────────────────────────────

/// 工具任务的执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// 对应任务的唯一 ID
    pub task_id: String,
    /// 结构化输出数据
    pub output: serde_json::Value,
    /// 任务最终状态
    pub status: ToolStatus,
    /// 执行耗时（毫秒）
    pub elapsed_ms: u64,
}

// ─────────────────────────── 调用上下文 ──────────────────────────────────

/// 工具被 `apply` 钩子主动调用时携带的上下文信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolContext {
    /// 发起调用的 Agent ID
    pub agent_id: String,
    /// 会话 ID（同一对话轮次共享）
    pub session_id: String,
    /// 工具调用参数
    pub params: serde_json::Value,
    /// 附加元数据（可存放 trace_id、priority 等）
    pub metadata: HashMap<String, serde_json::Value>,
}

// ─────────────────────────── 内部任务记录 ────────────────────────────────

/// 异步任务的内部状态快照
#[derive(Debug, Clone)]
pub struct TaskRecord {
    pub task_id: String,
    pub status: ToolStatus,
    pub result: Option<ToolResult>,
    pub created_at: Instant,
    pub updated_at: Instant,
}

impl TaskRecord {
    pub fn new(task_id: &str) -> Self {
        let now = Instant::now();
        Self {
            task_id: task_id.to_string(),
            status: ToolStatus::Pending,
            result: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn elapsed(&self) -> Duration {
        self.created_at.elapsed()
    }
}

// ─────────────────────────── Tool Trait ──────────────────────────────────

/// 所有工具必须实现的核心 Trait
pub trait Tool: Send + Sync {
    /// 返回工具元数据（静态定义，不可变）
    fn meta(&self) -> &ToolMeta;

    /// 注册工具（建立连接、校验资源、初始化状态）
    ///
    /// - 内置工具：默认实现，直接返回 `Ok(())`
    /// - 远程工具：重写此方法，建立 RPC/Stdio/MCP 连接
    fn register(&self) -> Result<(), ToolError> {
        Ok(())
    }

    /// 异步提交调用（被其他 Agent 或工具调用）
    ///
    /// 立即返回 `task_id`，实际执行在后台进行；
    /// 通过 [`Tool::status`] 和 [`Tool::result`] 轮询结果。
    fn call(&self, params: serde_json::Value) -> Result<String, ToolError>;

    /// 同步调用（在上下文 Hook 中主动触发）
    ///
    /// 阻塞直到执行完成，适合短时间、低延迟的场景；
    /// 默认实现会直接调用 `call` 并等待结果，子类可重写以实现优化路径。
    fn apply(&self, ctx: &ToolContext) -> Result<ToolResult, ToolError> {
        let task_id = self.call(ctx.params.clone())?;
        // 简单轮询等待（默认实现；高性能场景子类应重写为阻塞式执行）
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            match self.status(&task_id) {
                ToolStatus::Completed | ToolStatus::Failed(_) | ToolStatus::Cancelled => {
                    return self
                        .result(&task_id)
                        .ok_or_else(|| ToolError::TaskNotFound(task_id.clone()));
                }
                _ => {
                    if Instant::now() > deadline {
                        let _ = self.cancel(&task_id);
                        return Err(ToolError::Timeout(task_id));
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
            }
        }
    }

    /// 查询任务执行状态
    fn status(&self, task_id: &str) -> ToolStatus;

    /// 获取已完成任务的执行结果（任务未完成时返回 `None`）
    fn result(&self, task_id: &str) -> Option<ToolResult>;

    /// 取消指定任务（向后台执行发送取消信号）
    fn cancel(&self, task_id: &str) -> Result<(), ToolError>;

    /// 强制同步调用（忽略任何锁定或状态检查，直接执行）
    ///
    /// 用于调试、恢复或紧急场景；不创建任务记录，直接返回结果。
    fn force_call(&self, params: serde_json::Value) -> Result<ToolResult, ToolError>;
}

// ─────────────────────────── ToolRegistrar Trait ─────────────────────────

/// 工具注册器 Trait
///
/// 任何可以**持有并管理工具**的主体（Context、Agent、Swarm 等）均实现此接口。
/// 这使得"注册工具"这一能力可以被不同层级的主体统一复用。
pub trait ToolRegistrar: Send + Sync {
    /// 注册工具（调用工具自身的 `Tool::register()` 初始化后加入索引）
    fn register_tool(&mut self, tool: Arc<dyn Tool>) -> Result<(), ToolError>;

    /// 注销工具
    fn unregister_tool(&mut self, id: &str) -> Result<(), ToolError>;

    /// 按 ID 获取工具
    fn get_tool(&self, id: &str) -> Option<Arc<dyn Tool>>;

    /// 列出所有已注册工具的元数据（克隆副本，避免生命周期问题）
    fn list_tools(&self) -> Vec<ToolMeta>;

    /// 按类别筛选工具元数据
    fn list_tools_by_category(&self, category: &ToolCategory) -> Vec<ToolMeta>;

    /// 按类型筛选工具元数据（Buildin / Remote）
    fn list_tools_by_type(&self, tool_type: &ToolType) -> Vec<ToolMeta>;

    /// 判断工具是否已注册
    fn has_tool(&self, id: &str) -> bool {
        self.get_tool(id).is_some()
    }

    /// 已注册工具数量
    fn tool_count(&self) -> usize {
        self.list_tools().len()
    }
}

// ─────────────────────────── ToolStore（ToolRegistrar 标准实现） ──────────

/// 工具仓库（`ToolRegistrar` 的标准实现）
///
/// 可作为内部字段被组合进 `ContextWindow`、`Agent`、`Swarm` 等主体，
/// 通过委托（delegation）模式让它们实现 `ToolRegistrar`，避免重复逻辑。
///
/// > 原 `ToolRegistry` 已重命名为 `ToolStore`，语义更准确。
pub struct ToolStore {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl std::fmt::Debug for ToolStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ToolStore")
            .field("tool_ids", &self.tools.keys().collect::<Vec<_>>())
            .finish()
    }
}

impl ToolStore {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }
}

impl Default for ToolStore {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolRegistrar for ToolStore {
    fn register_tool(&mut self, tool: Arc<dyn Tool>) -> Result<(), ToolError> {
        let id = tool.meta().id.clone();
        if self.tools.contains_key(&id) {
            return Err(ToolError::AlreadyRegistered(id));
        }
        tool.register()?;
        self.tools.insert(id, tool);
        Ok(())
    }

    fn unregister_tool(&mut self, id: &str) -> Result<(), ToolError> {
        self.tools
            .remove(id)
            .map(|_| ())
            .ok_or_else(|| ToolError::NotFound(id.to_string()))
    }

    fn get_tool(&self, id: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(id).cloned()
    }

    fn list_tools(&self) -> Vec<ToolMeta> {
        let mut metas: Vec<ToolMeta> = self.tools.values().map(|t| t.meta().clone()).collect();
        metas.sort_by(|a, b| a.id.cmp(&b.id));
        metas
    }

    fn list_tools_by_category(&self, category: &ToolCategory) -> Vec<ToolMeta> {
        self.tools
            .values()
            .filter(|t| &t.meta().category == category)
            .map(|t| t.meta().clone())
            .collect()
    }

    fn list_tools_by_type(&self, tool_type: &ToolType) -> Vec<ToolMeta> {
        self.tools
            .values()
            .filter(|t| &t.meta().tool_type == tool_type)
            .map(|t| t.meta().clone())
            .collect()
    }
}

/// 向后兼容别名（旧代码引用 ToolRegistry 仍可编译）
pub type ToolRegistry = ToolStore;

// ─────────────────────────── 辅助函数 ────────────────────────────────────

/// 生成新的任务 ID
pub fn new_task_id() -> String {
    Uuid::new_v4().to_string()
}

/// 构建任务状态存储（供工具实现使用）
pub fn new_task_store() -> Arc<Mutex<HashMap<String, TaskRecord>>> {
    Arc::new(Mutex::new(HashMap::new()))
}
