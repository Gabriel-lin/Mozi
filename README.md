# Mozi

## Target

* Mission planning features
    1. CPU, GPU, memory, I/O, peripherals infos on agent app
    2. Task planning (general/professional/top-level/low-level),
       and dynamic adjustment (self-correcting with RL)
    3. Support text, pictures, voice, and video forms
    4. Agent's factory (workflow, langchain)
    5. Tools（fs/shell/fetch/auto llm/info extraction/log/askUser/sandbox/message channel/sound/visual）
    6. Skills (fetch info/policy/err handling/interactive system/memory)
    7. Context (perception subsys/action subsys/policy subsys)
    8. SubAgent
    9. Agent swarm (collaboration/master-slave)

* TTS model, vision model (MoE model), language model
    1. Use DeepSeek-R1 as the inference language model
    2. Deployment reasoning optimization — vLLM
    3. Fine tuning — RL

* Task plan agent
    1. Tools SDK
    2. RAG + CoT + Workflow + RL-online
    3. MCP + Skills

## Plan — v0.1.0

* Support text interaction, personalization and internationalization.
* DeepSeek-1B, Qwen-32B deployment and vLLM optimization
* Search tool, RAG

---

## Project Structure

```
Mozi/
├── package.json                ← npm workspace 根（workspaces: ["packages/*"]）
├── vite.config.js              ← Vite 构建配置（别名 @、@mozi/core）
├── tsconfig.json               ← TypeScript 配置（路径映射）
├── tailwind.config.js
├── src/                        ← 前端应用（React + Tauri）
│   ├── App.tsx                 ← 根组件（主题/语言/布局）
│   ├── components/             ← UI 组件（MenuBar、TitleBar、Dialog、shadcn/ui）
│   ├── hooks/                  ← React Hooks（useCpus 等）
│   ├── stores/                 ← Zustand 状态管理
│   ├── locales/                ← 国际化资源（en.json / zh.json）
│   ├── lib/                    ← 工具函数（cn）
│   └── types/                  ← 类型定义
│
├── packages/                   ← 前端 workspace 包
│   └── core/                   ← @mozi/core — 前端核心库
│       └── src/                （详见下方「前端核心库」）
│
└── src-tauri/                  ← Rust Cargo workspace 根
    ├── Cargo.toml              ← workspace 定义 + mozi 应用 crate
    ├── src/
    │   ├── main.rs             ← 二进制入口
    │   └── lib.rs              ← Tauri 应用（command 包装 + 插件注册）
    └── crates/
        └── mozi-core/          ← mozi-core — Rust 核心库（feature flags）
            └── src/            （详见下方「后端核心库」）
```

---

## 前端核心库 — `@mozi/core`

> `packages/core/` · npm workspace 成员 · 框架无关的纯 TypeScript 库

### 模块总览

| 模块 | 子路径导入 | 说明 |
|------|-----------|------|
| errors | `@mozi/core/errors` | 异常处理：分层错误码、领域异常类、全局捕获 |
| logger | `@mozi/core/logger` | 日志系统：多级别、多 Transport、结构化上下文 |
| plugin | `@mozi/core/plugin` | 插件系统：生命周期管理、依赖检查、事件通信 |
| workflow | `@mozi/core/workflow` | 工作流编排：DAG 图、条件分支、并行/重试/超时 |
| agent | `@mozi/core/agent` | 智能体工厂：ReAct 循环、工具调用、记忆管理 |
| data | `@mozi/core/data` | 数据工厂：DataSource 抽象、Pipeline、9 种转换器 |
| cli | `@mozi/core/cli` | 命令行工具：解析器、子命令、帮助生成 |
| storage | `@mozi/core/storage` | 存储系统：关系型 / 全文搜索 / 向量数据库驱动 |

### 目录结构

```
packages/core/src/
├── index.ts                     ← 统一入口（re-export 全部模块）
│
├── errors/                      ← 异常处理
│   ├── types.ts                 ← ErrorCode 枚举（E0000~E7xxx）、ErrorSeverity
│   ├── base.ts                  ← MoziError 基类 + 领域子类：
│   │                               HttpError · ValidationError · StorageError
│   │                               PluginError · WorkflowError · AgentError
│   │                               DataError · CliError
│   ├── handler.ts               ← 全局错误处理器 errorHandler
│   │                               tryCatch() / tryCatchAsync() 辅助函数
│   └── index.ts
│
├── logger/                      ← 日志系统
│   ├── types.ts                 ← LogLevel（TRACE~FATAL）、LogEntry、LogTransport 接口
│   ├── transport.ts             ← ConsoleTransport — 控制台输出
│   │                               MemoryTransport — 内存缓冲 + 查询
│   │                               BatchTransport — 批量异步刷写
│   ├── logger.ts                ← Logger 类（子日志 child()、多 transport、结构化 context）
│   └── index.ts
│
├── plugin/                      ← 插件系统
│   ├── types.ts                 ← Plugin 接口（install/activate/deactivate/uninstall）
│   │                               PluginMeta · PluginContext · PluginStatus
│   ├── manager.ts               ← PluginManager：注册 → 安装 → 激活 → 停用 → 卸载
│   │                               依赖检查、反向依赖保护、事件发布
│   └── index.ts
│
├── workflow/                    ← 工作流编排
│   ├── types.ts                 ← NodeType（task/condition/parallel/loop/sub_workflow）
│   │                               WorkflowNode · WorkflowEdge · WorkflowContext
│   │                               NodeHandler · NodeResult · WorkflowDefinition
│   ├── graph.ts                 ← WorkflowGraph — DAG 构建、环检测、拓扑排序
│   ├── engine.ts                ← WorkflowEngine — 执行引擎
│   │                               条件分支 · 并行节点 · 重试策略 · 超时控制
│   │                               事件发布（workflow:start/complete/fail、node:*）
│   └── index.ts
│
├── agent/                       ← 智能体工厂
│   ├── types.ts                 ← Agent 接口、AgentTool、AgentMemory、AgentBlueprint
│   │                               AgentStatus · AgentStep · AgentRunResult
│   ├── memory.ts                ← SimpleMemory — 容量受限记忆
│   │                               SlidingWindowMemory — 滑动窗口记忆（保留 system prompt）
│   ├── react-agent.ts           ← ReActAgent — Thought → Action → Observation 循环
│   │                               工具调用、步数限制、中断控制
│   ├── factory.ts               ← AgentFactory — 类型注册 + 蓝图模板创建
│   │                               AgentRegistry — 实例注册中心
│   └── index.ts
│
├── data/                        ← 数据工厂
│   ├── types.ts                 ← DataSource · DataQuery · DataSchema · FieldDef
│   ├── transformer.ts           ← 9 种数据转换器：
│   │                               mapFields · filterRecords · sortRecords · limitRecords
│   │                               pickFields · omitFields · computeField
│   │                               groupBy · aggregate
│   ├── pipeline.ts              ← DataPipeline — 链式阶段执行，错误定位到阶段
│   ├── factory.ts               ← MemoryDataSource — 内存数据源（支持 schema 验证）
│   │                               DataSourceRegistry — 数据源注册中心
│   │                               defineSchema() — Schema 定义辅助函数
│   └── index.ts
│
├── cli/                         ← 命令行工具
│   ├── types.ts                 ← CliCommand · CliArg · ParsedArgs · CliOutput 接口
│   ├── parser.ts                ← parseArgs() — 参数解析（--flag / -alias / 引号 / 类型转换）
│   │                               tokenize() — 字符串分词器
│   ├── runner.ts                ← CliRunner — 命令注册 / 子命令路由 / 帮助生成
│   │                               DefaultOutput — 文本输出（table/json 格式化）
│   └── index.ts
│
└── storage/                     ← 存储系统
    ├── types.ts                 ← 四层驱动接口：
    │                               StorageDriver — 基础（connect/disconnect/healthCheck）
    │                               RelationalDriver — 关系型（query/execute/transaction）
    │                               SearchDriver — 全文搜索（createIndex/search/bulkIndex）
    │                               VectorDriver — 向量（upsert/search/deleteVectors）
    ├── http.ts                  ← httpRequest() — 通用 HTTP 工具（超时/错误统一处理）
    └── drivers/
        ├── postgresql.ts        ← PostgreSQLDriver — 通过 HTTP API (PostgREST/Supabase)
        │                           query/execute/transaction/tableExists/listTables
        ├── sqlite.ts            ← SQLiteDriver — 通过 Tauri command + 内存模式兜底
        │                           query/execute/transaction/tableExists/listTables
        ├── opensearch.ts        ← OpenSearchDriver — RESTful API
        │                           createIndex/search/bulkIndex/deleteDocument
        └── vector/
            ├── base.ts          ← BaseVectorDriver — 抽象基类（连接管理/日志/错误处理）
            ├── pinecone.ts      ← PineconeDriver — Pinecone REST API
            ├── milvus.ts        ← MilvusDriver — Milvus v2 RESTful API
            ├── qdrant.ts        ← QdrantDriver — Qdrant REST API
            └── chroma.ts        ← ChromaDriver — Chroma REST API
```

### 存储驱动接口层级

```
StorageDriver（connect / disconnect / healthCheck）
├── RelationalDriver（query / execute / transaction）
│   ├── PostgreSQLDriver
│   └── SQLiteDriver
├── SearchDriver（createIndex / search / bulkIndex）
│   └── OpenSearchDriver
└── VectorDriver（createCollection / upsert / search）
    ├── PineconeDriver
    ├── MilvusDriver
    ├── QdrantDriver
    └── ChromaDriver
```

### 使用示例

```typescript
// 子路径导入（推荐，tree-shaking 友好）
import { Logger, LogLevel } from "@mozi/core/logger";
import { PluginManager } from "@mozi/core/plugin";
import { WorkflowEngine, NodeType } from "@mozi/core/workflow";
import { AgentFactory } from "@mozi/core/agent";
import { QdrantDriver } from "@mozi/core/storage";

// 或统一入口
import { Logger, PluginManager, WorkflowEngine } from "@mozi/core";
```

---

## 后端核心库 — `mozi-core`

> `src-tauri/crates/mozi-core/` · Cargo workspace 成员 · 纯 Rust 库（零 Tauri 依赖）

### Feature Flags

```toml
[features]
default = ["full"]
full    = ["agent", "context", "skills", "swarm", "tools", "system", "menu"]

tools   = ["dep:uuid", "dep:tokio"]          # 工具注册/调度/适配器
skills  = []                                  # 技能 trait + 内置技能
context = ["tools"]                           # 上下文窗口/感知/策略
agent   = ["tools", "skills", "context"]      # Agent trait + TaskAgent 等
swarm   = ["agent", "tools", "context"]       # 集群协作（主从/对等）
system  = ["dep:sysinfo"]                     # 系统信息采集
menu    = []                                  # 菜单状态管理
```

选择性启用：

```toml
[dependencies]
mozi-core = { path = "crates/mozi-core", default-features = false, features = ["agent", "system"] }
```

### 目录结构

```
src-tauri/crates/mozi-core/src/
├── lib.rs                       ← 条件编译入口（各模块按 feature flag 开关）
│
├── errors/                      ← 始终启用
│   ├── mod.rs                   ← AppError 统一错误（变体按 feature 条件编译）
│   ├── agent.rs                 ← AgentError 枚举
│   ├── context.rs               ← ContextError 枚举
│   ├── skills.rs                ← SkillsError 枚举
│   ├── swarm.rs                 ← SwarmError 枚举（From<AgentError>）
│   ├── sys.rs                   ← SysError 枚举（From<std::io::Error>）
│   └── tool.rs                  ← ToolError 枚举（is_retryable / is_protocol_error）
│
├── tools/                       ← feature = "tools"
│   ├── mod.rs                   ← 全局 ToolStore 单例 global_store()
│   ├── error.rs                 ← ToolError re-export
│   ├── registry.rs              ← Tool trait · ToolRegistrar trait · ToolStore
│   │                               ToolMeta · ToolType · ToolCategory · ToolStatus
│   │                               ToolResult · ToolContext · TaskRecord
│   ├── adapter/                 ← 协议适配器
│   │   ├── mod.rs               ← ToolAdapter trait · ToolCallRequest/Response
│   │   ├── openai.rs            ← OpenAIAdapter（Function Calling 格式）
│   │   ├── anthropic.rs         ← AnthropicAdapter（Tool Use 格式）
│   │   └── mcp.rs               ← McpAdapter（MCP 协议格式）
│   ├── buildin/                 ← 内置工具
│   │   ├── mod.rs               ← register_all() 批量注册
│   │   ├── echo.rs              ← EchoTool
│   │   ├── shell.rs             ← ShellTool
│   │   └── task.rs              ← 任务辅助函数（pub(super)）
│   └── remote/                  ← 远程工具
│       ├── mod.rs               ← RemoteProtocol 枚举
│       ├── rpc.rs               ← RpcTool（HTTP JSON-RPC 2.0）
│       ├── stdio.rs             ← StdioTool（子进程 stdin/stdout）
│       ├── mcp.rs               ← McpTool（MCP 协议）
│       └── session.rs           ← StdioSession（pub(super)）
│
├── skills/                      ← feature = "skills"
│   ├── mod.rs                   ← re-export 全部技能类型
│   ├── traits.rs                ← Skill trait（meta / execute / id / category）
│   ├── types.rs                 ← SkillMeta · SkillResult · SkillStatus
│   ├── registry.rs              ← SkillRegistrar trait
│   ├── store.rs                 ← SkillStore（SkillRegistrar 标准实现）
│   ├── fetch/                   ← 信息获取技能
│   │   ├── rag.rs               ← RagSkill — 向量检索增强
│   │   └── search.rs            ← WebSearchSkill — 实时网络搜索
│   ├── memory/                  ← 记忆技能
│   │   ├── short_term.rs        ← ShortTermMemorySkill — 对话摘要压缩
│   │   └── long_term.rs         ← LongTermMemorySkill — 跨会话知识持久化
│   ├── policy/                  ← 执行策略技能
│   │   ├── retry.rs             ← RetrySkill — 自动重试 + 退避
│   │   └── fallback.rs          ← FallbackSkill — 技能降级链
│   └── interactive/             ← 交互技能
│       ├── confirm.rs           ← UserConfirmSkill — 高风险操作授权
│       └── dialogue.rs          ← MultiTurnDialogueSkill — 多轮澄清对话
│
├── context/                     ← feature = "context"（依赖 tools）
│   ├── mod.rs                   ← re-export 全部上下文类型
│   ├── types.rs                 ← ContextSource · ContextEntry
│   ├── registry.rs              ← ContextRegistrar trait
│   ├── window.rs                ← ContextWindow — 有界滑动窗口 + 内嵌 ToolStore
│   ├── perception/              ← 感知层
│   │   ├── input.rs             ← PerceptionInput 枚举
│   │   ├── processor.rs         ← PerceptionProcessor trait + DefaultPerceptionProcessor
│   │   └── pipeline.rs          ← PerceptionPipeline — 管道调度
│   ├── action/                  ← 行动层
│   │   ├── types.rs             ← ActionKind · ActionOutcome
│   │   ├── record.rs            ← ActionRecord — 单条记录生命周期
│   │   └── history.rs           ← ActionHistory · ActionSummary
│   └── policy/                  ← 策略层
│       ├── types.rs             ← PolicyKind · PolicyDecision
│       ├── traits.rs            ← Policy trait
│       ├── rule.rs              ← RulePolicy + PolicyRule（规则基策略）
│       └── engine.rs            ← PolicyEngine — 责任链调度器
│
├── agent/                       ← feature = "agent"（依赖 tools + skills + context）
│   ├── mod.rs                   ← re-export 全部 Agent 类型
│   ├── types.rs                 ← AgentMeta · AgentStatus · AgentStep · RunRecord
│   ├── traits.rs                ← Agent trait（继承 ToolRegistrar + SkillRegistrar + ContextRegistrar）
│   ├── registry.rs              ← AgentRegistrar trait · AgentStore
│   ├── react.rs                 ← ReActEngine — Thought → Action → Observation 循环
│   ├── task.rs                  ← TaskAgent — 通用任务代理（CoT + ReAct + RAG）
│   ├── sub.rs                   ← SubAgent — 子代理（由 Swarm/Workflow 动态调度）
│   └── workflow.rs              ← WorkflowAgent — DAG 驱动的工作流代理
│
├── swarm/                       ← feature = "swarm"（依赖 agent + tools + context）
│   ├── mod.rs                   ← re-export 全部 Swarm 类型
│   ├── types.rs                 ← SwarmMode · SwarmMeta · SwarmStatus · SubTask · TaskPriority
│   ├── traits.rs                ← Swarm trait（继承 AgentRegistrar + ToolRegistrar + ContextRegistrar）
│   ├── scheduler.rs             ← Scheduler — 四种策略：RoundRobin / LoadBalanced / Priority / Affinity
│   ├── coordinator.rs           ← MessageBus + SwarmEvent — 集群内部消息总线
│   ├── master.rs                ← MasterSlaveSwarm — 主从模式（拆解 → 分发 → 汇总）
│   └── collab.rs                ← CollaborativeSwarm — 对等协作（P2P 消息 + 平均分发）
│
├── system/                      ← feature = "system"（依赖 sysinfo）
│   ├── mod.rs                   ← re-export 全部系统信息类型与函数
│   ├── info.rs                  ← SystemInfo · ProcessInfo · get_system_info()
│   ├── appearance.rs            ← is_dark_mode() · get_system_dark_mode()
│   ├── os.rs                    ← OsInfo · get_os_info()
│   ├── disk.rs                  ← DiskInfo · get_disk_info()
│   └── network.rs               ← NetworkInterface · get_network_info()
│
└── menu/                        ← feature = "menu"
    └── mod.rs                   ← set_current_language() · set_current_theme()
```

### Tauri 应用 crate（`src-tauri/src/lib.rs`）

应用 crate 不含业务逻辑，仅承担：

1. **Tauri command 包装** — 为 `mozi_core::system` 中的纯函数添加 `#[tauri::command]` 注解
2. **插件注册** — dialog / notification / clipboard / fs / shell / os / http / appearance
3. **事件监听** — `set-theme` / `set-language` 事件，委托给 `mozi_core::menu`

```rust
// 示例：command 包装
#[tauri::command]
fn get_system_info() -> mozi_core::system::SystemInfo {
    mozi_core::system::get_system_info()
}
```

### 模块依赖方向（严格单向，无循环）

```
errors（始终启用）
  ↑
tools  ←─  skills
  ↑          ↑
context ─────┘
  ↑
agent
  ↑
swarm

system（独立）    menu（独立）
```

---

## Registrar 注册器架构

注册器架构将"持有某类组件"的能力抽象为独立 Trait，使不同层级的主体
（Context、Agent、Swarm）可以通过实现对应 Trait 来复用注册逻辑。

### 注册关系总览

```
组件          注册器 Trait        可注册进的主体
────────────────────────────────────────────────────
Tool    ──→  ToolRegistrar    ──→  ContextWindow · Agent · Swarm
Skill   ──→  SkillRegistrar   ──→  Agent
Context ──→  ContextRegistrar ──→  Agent · Swarm
Agent   ──→  AgentRegistrar   ──→  Swarm
```

### 标准存储实现（XStore）

| Trait | 标准实现 | 被组合进 |
|-------|---------|---------|
| `ToolRegistrar` | `ToolStore` | `ContextWindow` · 具体 Agent · 具体 Swarm |
| `SkillRegistrar` | `SkillStore` | 具体 Agent |
| `ContextRegistrar` | —（直接持有 `Option<ContextWindow>`） | 具体 Agent · 具体 Swarm |
| `AgentRegistrar` | `AgentStore` | 具体 Swarm |

### Trait 继承关系

```
Agent trait  继承：ToolRegistrar + SkillRegistrar + ContextRegistrar
Swarm trait  继承：AgentRegistrar + ToolRegistrar + ContextRegistrar
```

### 核心设计收益

| 收益 | 说明 |
|------|------|
| **统一注册接口** | `register_all(&mut dyn ToolRegistrar)` 可将内置工具批量注册进任意主体 |
| **能力即接口** | 持有工具/技能/上下文是一种"能力"，调用方只依赖 Trait，便于 mock 与测试 |
| **作用域天然分层** | Tool 可注册进 Context（会话级）/ Agent（实例级）/ Swarm（集群级） |
| **无重复代码** | 各层主体通过组合 XStore + 委托实现 Trait，存储逻辑集中不分散 |
| **依赖方向清晰** | tools → skills → context → agent → swarm，单向依赖无循环 |

---

## Technology Stack

### Frontend
* React 19, Tailwind CSS 4, Zustand, shadcn/ui, Vite 6
* ECharts, react-hook-form + Zod, i18next
* `@mozi/core` — 框架无关核心库（npm workspace）

### Backend
* Rust, Tauri 2, Cargo workspace
* `mozi-core` — 纯 Rust 核心库（feature flags 按需启用）
* sysinfo, thiserror, tokio, uuid, serde

### Infrastructure
* Docker, DevContainer
* Microservices, WASM

---

## Development

> * Node 22 required
> * Configure proxy if needed
> * Start with `NO_PROXY=localhost,127.0.0.1 npm run tauri:dev` on WSL2
