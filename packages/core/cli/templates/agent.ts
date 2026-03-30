import type { Template } from "../types";
import { toKebabCase } from "../utils";

function vars(v: Record<string, unknown>) {
  const name = String(v.name ?? "my-agent");
  const id = toKebabCase(name);
  const desc = String(v.description ?? "");
  const maxSteps = Number(v.maxSteps ?? 10);
  const model = String(v.model ?? "gpt-4");
  return { name, id, desc, maxSteps, model };
}

export const agentTemplates: Template[] = [
  {
    name: "basic",
    description: "基础智能体 — 简单的问答与任务执行",
    category: "agent",
    variables: [
      { name: "name", description: "智能体名称", type: "string", required: true },
      { name: "description", description: "智能体描述", type: "string", default: "" },
      { name: "maxSteps", description: "最大执行步骤数", type: "number", default: 10 },
    ],
    render(v) {
      const { name, id, desc, maxSteps } = vars(v);
      return [
        {
          path: `${id}/index.ts`,
          content: [
            'import type { AgentConfig } from "@mozi/core";',
            "",
            "const config: AgentConfig = {",
            "  meta: {",
            `    id: "${id}",`,
            `    name: "${name}",`,
            `    description: "${desc || name + " 智能体"}",`,
            `    maxSteps: ${maxSteps},`,
            "  },",
            '  systemPrompt: "你是一个智能助手，请帮助用户完成任务。",',
            "  tools: [],",
            "};",
            "",
            "export default config;",
            "",
          ].join("\n"),
        },
      ];
    },
  },

  {
    name: "react",
    description: "ReAct 推理智能体 — 思考-行动-观察循环",
    category: "agent",
    variables: [
      { name: "name", description: "智能体名称", type: "string", required: true },
      { name: "description", description: "智能体描述", type: "string", default: "" },
      { name: "maxSteps", description: "最大执行步骤数", type: "number", default: 20 },
      { name: "model", description: "LLM 模型", type: "string", default: "gpt-4" },
    ],
    render(v) {
      const { name, id, desc, maxSteps, model } = vars(v);
      return [
        {
          path: `${id}/index.ts`,
          content: [
            'import { ReActAgent } from "@mozi/core";',
            'import type { AgentConfig, AgentTool } from "@mozi/core";',
            "",
            "const tools: AgentTool[] = [",
            "  // 在此注册你的工具",
            "];",
            "",
            "const config: AgentConfig = {",
            "  meta: {",
            `    id: "${id}",`,
            `    name: "${name}",`,
            `    description: "${desc || name + " — ReAct 推理智能体"}",`,
            `    maxSteps: ${maxSteps},`,
            `    model: "${model}",`,
            "  },",
            "  tools,",
            "  systemPrompt: [",
            '    "你是一个基于 ReAct 框架的推理智能体。",',
            '    "对于每个任务，遵循以下流程：",',
            '    "1. Thought（思考）: 分析当前状态，决定下一步",',
            '    "2. Action（行动）: 选择并调用工具",',
            '    "3. Observation（观察）: 处理工具返回结果",',
            '    "重复以上步骤，直到任务完成。",',
            '  ].join("\\n"),',
            "  onStep(step) {",
            "    console.log(`[步骤 ${step.stepId}] ${step.thought ?? \"\"}`);",
            "  },",
            "};",
            "",
            "export function create() {",
            "  return new ReActAgent(config);",
            "}",
            "",
            "export default config;",
            "",
          ].join("\n"),
        },
      ];
    },
  },

  {
    name: "conversational",
    description: "对话式智能体 — 多轮对话与上下文记忆",
    category: "agent",
    variables: [
      { name: "name", description: "智能体名称", type: "string", required: true },
      { name: "description", description: "智能体描述", type: "string", default: "" },
      { name: "maxSteps", description: "最大步骤数", type: "number", default: 50 },
      { name: "model", description: "LLM 模型", type: "string", default: "gpt-4" },
    ],
    render(v) {
      const { name, id, desc, maxSteps, model } = vars(v);
      return [
        {
          path: `${id}/index.ts`,
          content: [
            'import { SlidingWindowMemory } from "@mozi/core";',
            'import type { AgentConfig } from "@mozi/core";',
            "",
            "const config: AgentConfig = {",
            "  meta: {",
            `    id: "${id}",`,
            `    name: "${name}",`,
            `    description: "${desc || name + " — 对话式智能体"}",`,
            `    maxSteps: ${maxSteps},`,
            `    model: "${model}",`,
            "  },",
            "  tools: [],",
            "  systemPrompt: [",
            '    "你是一个友好的对话助手。",',
            '    "请保持上下文连贯性，记住对话历史。",',
            '    "用自然、简洁的方式回答用户问题。",',
            '  ].join("\\n"),',
            "};",
            "",
            "export function createMemory(windowSize = 20) {",
            "  return new SlidingWindowMemory(windowSize);",
            "}",
            "",
            "export default config;",
            "",
          ].join("\n"),
        },
      ];
    },
  },

  {
    name: "tool-use",
    description: "工具调用智能体 — 专注于工具编排与调用",
    category: "agent",
    variables: [
      { name: "name", description: "智能体名称", type: "string", required: true },
      { name: "description", description: "智能体描述", type: "string", default: "" },
      { name: "maxSteps", description: "最大步骤数", type: "number", default: 15 },
    ],
    render(v) {
      const { name, id, desc, maxSteps } = vars(v);
      return [
        {
          path: `${id}/index.ts`,
          content: [
            'import type { AgentConfig, AgentTool } from "@mozi/core";',
            "",
            "const searchTool: AgentTool = {",
            '  name: "search",',
            '  description: "搜索知识库",',
            "  parameters: {",
            '    query: { type: "string", description: "搜索关键词" },',
            "  },",
            "  async execute(params) {",
            '    const query = params.query as string;',
            "    // TODO: 实现搜索逻辑",
            "    return { results: [], query };",
            "  },",
            "};",
            "",
            "const calculatorTool: AgentTool = {",
            '  name: "calculator",',
            '  description: "数学计算",',
            "  parameters: {",
            '    expression: { type: "string", description: "数学表达式" },',
            "  },",
            "  async execute(params) {",
            '    const expr = params.expression as string;',
            "    // TODO: 安全的表达式求值",
            "    return { result: expr };",
            "  },",
            "};",
            "",
            "const config: AgentConfig = {",
            "  meta: {",
            `    id: "${id}",`,
            `    name: "${name}",`,
            `    description: "${desc || name + " — 工具调用智能体"}",`,
            `    maxSteps: ${maxSteps},`,
            "  },",
            "  tools: [searchTool, calculatorTool],",
            "  systemPrompt: [",
            '    "你是一个工具调用智能体，擅长使用各种工具完成任务。",',
            '    "可用工具: search（搜索）, calculator（计算）",',
            '    "根据任务需要，选择合适的工具并提供正确的参数。",',
            '  ].join("\\n"),',
            "};",
            "",
            "export default config;",
            "",
          ].join("\n"),
        },
      ];
    },
  },
];
