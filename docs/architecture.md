# Mozi 后端架构方案 v2.0

> 文档版本: v2.0  
> 创建日期: 2026-03-24  
> 状态: 已批准，实施中

---

## 1. 项目背景

Mozi 是一个基于 Tauri 2 的桌面 AI 应用平台，提供 Agent 编排、Workflow 引擎、Swarm 集群、数据工厂等能力。

后端需要支撑：
- 安全的用户认证与权限管理
- 多工作区隔离与协作
- LangChain Agent 自定义与沙箱执行
- vLLM 模型推理（自部署）
- MCP 协议（对外暴露能力 + 聚合外部工具）
- 千万级用户规模

---

## 2. 现有技术栈（前端 + 桌面壳，不变）

| 层级         | 技术                                                                |
| ------------ | ------------------------------------------------------------------- |
| 桌面壳       | Tauri 2 (Rust)                                                      |
| 前端         | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Radix UI         |
| 状态管理     | Zustand (持久化到 Tauri plugin-store)                               |
| Monorepo     | npm workspaces (`@mozi/core`, `@mozi/store`)                       |
| 核心库       | Agent (ReAct), Workflow Engine, Plugin System, Data Pipeline, CLI  |

---

## 3. 后端架构总览

```
Tauri Desktop App (React 19)
        │ HTTPS
        ▼
┌─ APISIX Gateway (路由/限流/JWT验证) ────────────────────┐
│                                                          │
│  /api/v1/auth/*       → auth-service      (FastAPI:3001) │
│  /api/v1/users/*      → workspace-service (FastAPI:3002) │
│  /api/v1/workspaces/* → workspace-service                │
│  /api/v1/agents/*     → agent-service     (FastAPI:3003) │
│  /mcp/*               → mcp-service       (FastAPI:3004) │
│                                                          │
└──────────────────────────────────────────────────────────┘
        │
        ▼ (Celery task dispatch)
  sandbox-service (Celery Worker)
        │
        ├─→ mcp-service Gateway (动态发现外部 MCP Tools)
        ├─→ LangChain Agent (自定义 chains/tools + MCP tools)
        ├─→ vLLM (OpenAI-compat API, A100)
        └─→ K8s Job (隔离沙箱)

  mcp-service (双向 MCP 枢纽)
        │
        ├─→ MCP Server: 对外暴露 Mozi 能力 (Agent/Workflow/Data)
        │    └─ 外部 AI 工具 (Cursor, Claude Desktop 等) 可调用
        └─→ MCP Gateway: 聚合外部 MCP Server
             └─ filesystem, database, web-search, 自定义 MCP 等

数据层:
  PostgreSQL 16 + pgvector  ← 所有服务共享
  Redis 7                   ← Celery broker + session cache
  MinIO / 阿里云 OSS        ← 对象存储
```

---

## 4. 技术选型

### 4.1 后端语言 — Python

选择 Python 作为唯一后端语言，统一 AI 生态：
- LangChain / LangGraph / LangSmith 全部 Python 原生
- vLLM Python SDK 深度集成
- MCP Python SDK (Anthropic 官方)
- 千万级规模通过 K8s 横向扩展解决

### 4.2 API 框架 — FastAPI

- async 原生，Pydantic v2 验证，自动 OpenAPI 文档
- 千万级规模已验证（Netflix, Uber, Microsoft）
- 4 个 HTTP 微服务各自独立 FastAPI 实例

### 4.3 ORM — SQLAlchemy 2.0 (async)

- Python 生态最成熟的 ORM
- 完整的 migration 工具 (Alembic)
- pgvector 支持 (pgvector-python)

### 4.4 任务队列 — Celery + Redis

- Agent 任务调度、重试、优先级、并发限制
- Redis 同时作为 broker、session 缓存、速率限制

### 4.5 Agent 框架 — LangChain + LangGraph

- Agent 自定义（自定义 Chain, Tool, Memory, Callback）
- 多 Agent 编排（LangGraph）
- 可观测性（LangSmith）

### 4.6 推理服务 — vLLM

- 自部署，A100 单卡
- OpenAI-compatible API
- 支持 LoRA 热加载 / continuous batching

### 4.7 MCP 协议 — mcp Python SDK

- Streamable HTTP 传输
- MCP Server: 对外暴露 Mozi Agent/Workflow/Data 能力
- MCP Gateway: 聚合外部 MCP Server，供 Agent 动态调用

### 4.8 基础设施 — 阿里云 ACK (Kubernetes)

- GPU 节点池 (A100) 用于 vLLM
- CPU 节点池用于微服务
- APISIX Ingress Controller
- Kustomize 管理多环境

---

## 5. 微服务拆分

| 服务 | 端口 | 职责 | 类型 |
|------|------|------|------|
| auth-service | 3001 | GitHub OAuth, JWT, session | FastAPI HTTP |
| workspace-service | 3002 | 用户/角色/权限/工作区 CRUD | FastAPI HTTP |
| agent-service | 3003 | Agent CRUD, 运行调度 | FastAPI HTTP |
| mcp-service | 3004 | MCP Server + Gateway | FastAPI HTTP |
| sandbox-service | — | Agent 执行, LangChain, vLLM 调用 | Celery Worker |
| vLLM | 8000 | 模型推理 | vLLM OpenAI API |

---

## 6. 目录结构

```
Mozi/
├── packages/
│   ├── core/                    # @mozi/core (TS, 前端)
│   └── store/                   # @mozi/store (TS, 前端)
├── server/                      # Python 后端
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   ├── shared/                  # 共享层
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── security.py
│   │   └── dependencies.py
│   ├── services/
│   │   ├── auth/
│   │   ├── workspace/
│   │   ├── agent/
│   │   ├── sandbox/
│   │   └── mcp/
│   ├── scripts/
│   └── tests/
├── deploy/                      # K8s manifests
│   ├── base/
│   └── overlays/
├── src/                         # Tauri 前端 (React)
├── src-tauri/                   # Rust 桌面壳
├── docker-compose.yml
└── docs/
```

---

## 7. 数据模型

```
users ──< workspace_members >── workspaces
  │
  └──< user_roles >── roles (permissions[])

agents ──< agent_runs (steps[], output)
  └── workspace_id → workspaces

embeddings (pgvector) → workspaces
sessions → users
mcp_servers → workspaces
```

---

## 8. 部署架构

### 开发环境
docker-compose: PostgreSQL + Redis + MinIO + 5 服务 + vLLM mock

### 生产环境 (阿里云 ACK)
- CPU 节点池: auth, workspace, agent, mcp, sandbox workers
- GPU 节点池: vLLM (A100)
- APISIX Ingress: 路由 + 限流 + JWT
- Kustomize overlays: dev / prod
- HPA: 按 CPU / 队列长度自动扩缩

---

## 9. 实施路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| 1 | Python 项目结构 + shared 层 | 进行中 |
| 2 | auth-service | 待开始 |
| 3 | workspace-service | 待开始 |
| 4 | agent-service | 待开始 |
| 5 | sandbox-service + LangChain | 待开始 |
| 6 | mcp-service | 待开始 |
| 7 | Alembic 迁移 + seed | 待开始 |
| 8 | Dockerfiles | 待开始 |
| 9 | K8s manifests | 待开始 |
| 10 | docker-compose 本地开发 | 待开始 |
| 11 | 清理旧 TS 后端 | 待开始 |
