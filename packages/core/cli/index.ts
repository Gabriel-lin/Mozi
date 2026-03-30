// ── 主程序 ───────────────────────────────────────────────────────────────────
export { createProgram, registerCustomCommand, runProgram } from "./program";

// ── 命令注册 ─────────────────────────────────────────────────────────────────
export {
  registerCreateCommand,
  registerExecCommand,
  registerRunCommand,
  registerListCommand,
} from "./commands";

// ── 模板系统 ─────────────────────────────────────────────────────────────────
export {
  getTemplate,
  listTemplates,
  getTemplateNames,
  registerTemplate,
  unregisterTemplate,
  agentTemplates,
  workflowTemplates,
  skillTemplates,
  contextTemplates,
} from "./templates";

// ── 工具函数 ─────────────────────────────────────────────────────────────────
export { ui, toKebabCase, toPascalCase, toCamelCase } from "./utils";
export {
  promptInput,
  promptSelect,
  promptConfirm,
  promptNumber,
  promptVariables,
  writeGeneratedFiles,
  pathExists,
} from "./utils";

// ── 类型导出 ─────────────────────────────────────────────────────────────────
export type {
  Template,
  TemplateCategory,
  TemplateVariable,
  GeneratedFile,
  CustomCommandConfig,
  CreateOptions,
  ExecOptions,
  RunOptions,
  ListOptions,
  CliOutput,
} from "./types";

export {
  CreateOptionsSchema,
  ExecOptionsSchema,
  RunOptionsSchema,
  ListOptionsSchema,
} from "./types";
