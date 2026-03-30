# @mozi/core — CLI 模块

基于 **commander** + **zod** + **enquirer** + **chalk** 构建的命令行工具，用于创建和管理 Mozi 平台的智能体、工作流、技能与上下文。

## 快速开始

```bash
# 在 packages/core 目录下
npm run mozi -- --help

# 或在项目根目录
npx tsx packages/core/src/cli/bin.ts --help
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `mozi create <type> [name]` | 创建智能体 / 工作流 / 技能 / 上下文 |
| `mozi exec <script> [args...]` | 执行外部命令或脚本 |
| `mozi run agent <target>` | 运行智能体 |
| `mozi run workflow <target>` | 运行工作流 |
| `mozi list templates` | 列出所有可用模板 |
| `mozi list agents` | 列出智能体模板 |
| `mozi list workflows` | 列出工作流模板 |
| `mozi list skills` | 列出技能模板 |
| `mozi list contexts` | 列出上下文模板 |
| `mozi --version` | 显示版本号 |
| `mozi --help` | 显示帮助信息 |

---

## 使用示例

### 查看帮助

```bash
$ mozi --help

  ╔══════════════════════════════════╗
  ║   M O Z I  —  智能编排平台      ║
  ╚══════════════════════════════════╝

Usage: mozi [options] [command]

Mozi — 智能体、工作流与技能编排平台

Options:
  -v, --version  显示版本号
  -h, --help     显示帮助信息

Commands:
  create         创建智能体、工作流、技能或上下文
  exec           执行外部命令或脚本
  help           display help for command
  list           列出可用资源与模板
  run            运行智能体或工作流
```

### 查看版本

```bash
$ mozi --version
0.1.0
```

---

### create — 创建资源

按内置模板生成智能体、工作流、技能或上下文的脚手架代码。

```bash
# 查看 create 命令的详细帮助
$ mozi create --help
```

**创建智能体** — 使用 ReAct 推理模板：

```bash
$ mozi create agent my-bot --template react --output ./agents --force

ℹ 正在创建 智能体 (Agent): my-bot
  模板: react
  输出: ./agents
✓ 创建: my-bot/index.ts

✓ 成功创建 1 个文件
```

**创建工作流** — 使用 ETL 管道模板：

```bash
$ mozi create workflow data-pipeline --template pipeline --output ./workflows --force

ℹ 正在创建 工作流 (Workflow): data-pipeline
  模板: pipeline
  输出: ./workflows
✓ 创建: data-pipeline/index.ts

✓ 成功创建 1 个文件
```

**创建技能** — 使用 API 调用模板：

```bash
$ mozi create skill web-search --template api --output ./skills --force

ℹ 正在创建 技能 (Skill): web-search
  模板: api
  输出: ./skills
✓ 创建: web-search/index.ts

✓ 成功创建 1 个文件
```

**创建上下文** — 使用对话上下文模板：

```bash
$ mozi create context chat-ctx --template conversation --output ./contexts --force

ℹ 正在创建 上下文 (Context): chat-ctx
  模板: conversation
  输出: ./contexts
✓ 创建: chat-ctx/index.ts

✓ 成功创建 1 个文件
```

**交互式创建** — 通过提示选择模板和填写参数：

```bash
$ mozi create agent -i
```

#### create 选项

| 选项 | 说明 |
|------|------|
| `-t, --template <name>` | 使用指定模板（不指定则默认 `basic`） |
| `-o, --output <dir>` | 输出目录，默认当前目录 |
| `-d, --description <text>` | 资源描述 |
| `-i, --interactive` | 交互式模式，逐步引导填写 |
| `-f, --force` | 覆盖已存在的文件 |

---

### exec — 执行外部命令

```bash
# 执行简单命令
$ mozi exec echo "Hello from Mozi CLI"

ℹ 执行: echo Hello from Mozi CLI

Hello from Mozi CLI

✓ 命令执行完成
```

```bash
# 指定工作目录和超时
$ mozi exec node index.js --cwd /app --timeout 30000

# 传递环境变量
$ mozi exec ./deploy.sh --env NODE_ENV=production PORT=3000

# 指定 shell
$ mozi exec ./build.sh --shell bash

# 静默模式
$ mozi exec npm test --silent
```

#### exec 选项

| 选项 | 说明 |
|------|------|
| `-c, --cwd <dir>` | 工作目录 |
| `-t, --timeout <ms>` | 超时时间（毫秒） |
| `-s, --shell <shell>` | 指定 shell（如 bash, zsh） |
| `-e, --env <pairs...>` | 环境变量，格式 `KEY=VALUE` |
| `--silent` | 静默模式，不输出子进程的 stdout |

---

### run — 运行智能体或工作流

```bash
# 运行智能体（dry-run 模式验证配置）
$ mozi run agent my-bot --goal "分析数据" --dry-run --verbose

ℹ 准备运行智能体: my-bot
  配置: 无
  参数: 无
  目标: 分析数据

⚠ Dry-run 模式，跳过执行

智能体运行摘要

  目标  my-bot
  任务  分析数据
  配置  (默认)
  参数  (无)
```

```bash
# 从配置文件运行智能体
$ mozi run agent ./agents/my-bot/index.ts --goal "总结报告" --verbose

# 运行工作流，传入初始数据
$ mozi run workflow etl-pipeline --data '{"source": "api"}' --verbose

# 从配置文件运行工作流
$ mozi run workflow ./workflows/my-flow.ts --config config.json
```

#### run agent 选项

| 选项 | 说明 |
|------|------|
| `-g, --goal <text>` | 智能体目标 / 任务描述 |
| `-c, --config <file>` | 配置文件路径（JSON） |
| `-p, --params <json>` | 运行参数（JSON 字符串） |
| `--verbose` | 详细输出 |
| `--dry-run` | 仅验证，不执行 |

#### run workflow 选项

| 选项 | 说明 |
|------|------|
| `-c, --config <file>` | 配置文件路径（JSON） |
| `-p, --params <json>` | 运行参数（JSON 字符串） |
| `-d, --data <json>` | 初始数据（JSON 字符串） |
| `--verbose` | 详细输出 |
| `--dry-run` | 仅验证，不执行 |

---

### list — 列出模板

```bash
# 列出所有模板（格式化表格）
$ mozi list templates

  可用模板

  智能体 (agent)

 模板             │ 描述                           │ 参数
────────────────┼──────────────────────────────┼─────────────────────────────
 basic          │ 基础智能体 — 简单的问答与任务执行        │ name*, description, maxSteps
 react          │ ReAct 推理智能体 — 思考-行动-观察循环    │ name*, description, maxSteps, model
 conversational │ 对话式智能体 — 多轮对话与上下文记忆        │ name*, description, maxSteps, model
 tool-use       │ 工具调用智能体 — 专注于工具编排与调用       │ name*, description, maxSteps

  工作流 (workflow)

 模板          │ 描述                           │ 参数
─────────────┼──────────────────────────────┼─────────────────────────────
 sequential  │ 顺序工作流 — 节点按顺序依次执行          │ name*, description, timeout
 parallel    │ 并行工作流 — 多节点并行执行后汇聚         │ name*, description, timeout
 conditional │ 条件工作流 — 基于条件分支执行不同路径       │ name*, description
 pipeline    │ 数据管道工作流 — ETL 式数据处理流水线     │ name*, description, timeout

  技能 (skill)

 模板        │ 描述                           │ 参数
───────────┼──────────────────────────────┼──────────────────────────────
 basic     │ 基础技能 — 可复用的工具集合             │ name*, description, version
 api       │ API 调用技能 — 封装外部 API 为工具     │ name*, description, baseUrl, version
 transform │ 数据转换技能 — 数据格式化与转换工具集        │ name*, description, version

  上下文 (context)

 模板           │ 描述                          │ 参数
──────────────┼─────────────────────────────┼────────────────────────────
 basic        │ 基础上下文 — 通用键值存储上下文          │ name*, description
 conversation │ 对话上下文 — 维护对话历史与角色状态        │ name*, description, maxHistory
 task         │ 任务上下文 — 任务执行状态与结果追踪        │ name*, description
```

```bash
# 按类型列出
$ mozi list agents
$ mozi list workflows
$ mozi list skills
$ mozi list contexts

# JSON 格式输出（便于程序解析）
$ mozi list templates --json
```

#### list 选项

| 选项 | 说明 |
|------|------|
| `-c, --category <type>` | 按类型过滤（仅 `list templates`） |
| `--json` | 以 JSON 格式输出 |

---

## 编程使用

### 创建并运行 CLI 程序

```typescript
import { createProgram, runProgram } from "@mozi/core/cli";

// 方式一：直接运行（使用 process.argv）
await runProgram();

// 方式二：创建程序后自行解析
const program = createProgram("1.0.0");
await program.parseAsync(process.argv);
```

### 注册自定义命令

```typescript
import { createProgram, registerCustomCommand } from "@mozi/core/cli";

const program = createProgram();

registerCustomCommand(program, {
  name: "deploy",
  description: "部署到指定环境",
  aliases: ["d"],
  args: [
    { name: "env", description: "目标环境", required: true },
  ],
  options: [
    { flags: "--tag <tag>", description: "版本标签" },
    { flags: "--dry-run", description: "仅预览，不执行" },
  ],
  handler: async (args, opts) => {
    console.log(`部署到 ${args.env}，标签: ${opts.tag ?? "latest"}`);
  },
});

await program.parseAsync(process.argv);
```

### 模板 API

```typescript
import {
  listTemplates,
  getTemplate,
  getTemplateNames,
  registerTemplate,
} from "@mozi/core/cli";

// 列出所有智能体模板
const agentTemplates = listTemplates("agent");

// 获取指定模板并渲染
const tpl = getTemplate("workflow", "pipeline");
if (tpl) {
  const files = tpl.render({ name: "etl-job", timeout: 60000 });
  // files = [{ path: "etl-job/index.ts", content: "..." }]
}

// 查看某类模板名称
const names = getTemplateNames("skill"); // ["basic", "api", "transform"]

// 注册自定义模板
registerTemplate({
  name: "custom-agent",
  description: "自定义智能体模板",
  category: "agent",
  variables: [
    { name: "name", description: "名称", type: "string", required: true },
  ],
  render(vars) {
    return [{
      path: `${vars.name}/index.ts`,
      content: `// 自定义智能体: ${vars.name}\nexport default {};\n`,
    }];
  },
});
```

### 交互式提示

```typescript
import {
  promptInput,
  promptSelect,
  promptConfirm,
  promptNumber,
} from "@mozi/core/cli";

const name = await promptInput("项目名称", "my-project");
const template = await promptSelect("选择模板", ["basic", "react", "tool-use"]);
const steps = await promptNumber("最大步骤数", 20);
const confirm = await promptConfirm("确认创建?");
```

---

## 内置模板

### 智能体模板 (4 个)

| 模板 | 说明 | 关键参数 |
|------|------|----------|
| `basic` | 基础问答智能体 | `name*`, `description`, `maxSteps` |
| `react` | ReAct 推理智能体（思考-行动-观察循环） | `name*`, `description`, `maxSteps`, `model` |
| `conversational` | 多轮对话智能体（上下文记忆） | `name*`, `description`, `maxSteps`, `model` |
| `tool-use` | 工具调用智能体（内含示例工具） | `name*`, `description`, `maxSteps` |

### 工作流模板 (4 个)

| 模板 | 说明 | 关键参数 |
|------|------|----------|
| `sequential` | 顺序执行工作流 | `name*`, `description`, `timeout` |
| `parallel` | 并行执行后汇聚 | `name*`, `description`, `timeout` |
| `conditional` | 条件分支工作流 | `name*`, `description` |
| `pipeline` | ETL 数据管道 | `name*`, `description`, `timeout` |

### 技能模板 (3 个)

| 模板 | 说明 | 关键参数 |
|------|------|----------|
| `basic` | 可复用工具集合 | `name*`, `description`, `version` |
| `api` | 封装外部 API（GET/POST） | `name*`, `description`, `baseUrl`, `version` |
| `transform` | 数据格式化与转换 | `name*`, `description`, `version` |

### 上下文模板 (3 个)

| 模板 | 说明 | 关键参数 |
|------|------|----------|
| `basic` | 通用键值存储 | `name*`, `description` |
| `conversation` | 对话历史与角色管理 | `name*`, `description`, `maxHistory` |
| `task` | 任务状态与结果追踪 | `name*`, `description` |

> `*` 标注的为必填参数

---

## 技术栈

| 库 | 用途 |
|----|------|
| [commander](https://github.com/tj/commander.js) | 命令行参数解析与子命令路由 |
| [zod](https://github.com/colinhacks/zod) | 输入参数校验 |
| [enquirer](https://github.com/enquirer/enquirer) | 交互式终端提示 |
| [chalk](https://github.com/chalk/chalk) | 终端彩色输出 |

## 目录结构

```
src/cli/
├── index.ts              # 统一导出入口
├── types.ts              # 类型定义 + Zod Schemas
├── utils.ts              # chalk 格式化 / enquirer 封装 / 文件工具
├── program.ts            # commander 主程序 + 自定义命令注册
├── bin.ts                # CLI 可执行入口
├── commands/
│   ├── index.ts          # 命令导出
│   ├── create.ts         # mozi create
│   ├── exec.ts           # mozi exec
│   ├── run.ts            # mozi run
│   └── list.ts           # mozi list
└── templates/
    ├── index.ts           # 模板注册表
    ├── agent.ts           # 智能体模板 ×4
    ├── workflow.ts        # 工作流模板 ×4
    ├── skill.ts           # 技能模板 ×3
    └── context.ts         # 上下文模板 ×3
```
