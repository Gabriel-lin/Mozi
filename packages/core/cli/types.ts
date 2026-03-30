import { z } from "zod";

// ── 模板系统类型 ─────────────────────────────────────────────────────────────

export type TemplateCategory = "agent" | "workflow" | "skill" | "context";

export interface TemplateVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "select";
  choices?: string[];
  default?: unknown;
  required?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface Template {
  name: string;
  description: string;
  category: TemplateCategory;
  variables: TemplateVariable[];
  render(vars: Record<string, unknown>): GeneratedFile[];
}

// ── Zod 校验 Schemas ────────────────────────────────────────────────────────

export const CreateOptionsSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  template: z.string().optional(),
  output: z.string().optional(),
  interactive: z.boolean().optional(),
  force: z.boolean().optional(),
  description: z.string().optional(),
});

export type CreateOptions = z.infer<typeof CreateOptionsSchema>;

export const ExecOptionsSchema = z.object({
  script: z.string().min(1, "脚本路径不能为空"),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().positive("超时时间必须为正数").optional(),
  shell: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export type ExecOptions = z.infer<typeof ExecOptionsSchema>;

export const RunOptionsSchema = z.object({
  target: z.string().min(1, "目标不能为空"),
  config: z.string().optional(),
  params: z.string().optional(),
  goal: z.string().optional(),
  verbose: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export type RunOptions = z.infer<typeof RunOptionsSchema>;

export const ListOptionsSchema = z.object({
  category: z.enum(["agent", "workflow", "skill", "context"]).optional(),
  format: z.enum(["table", "json", "plain"]).optional(),
});

export type ListOptions = z.infer<typeof ListOptionsSchema>;

// ── 自定义命令类型 ───────────────────────────────────────────────────────────

export interface CustomCommandConfig {
  name: string;
  description: string;
  aliases?: string[];
  args?: Array<{
    name: string;
    description: string;
    required?: boolean;
    defaultValue?: string;
  }>;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: unknown;
  }>;
  handler: (args: Record<string, unknown>, opts: Record<string, unknown>) => void | Promise<void>;
}

// ── 输出接口 ─────────────────────────────────────────────────────────────────

export interface CliOutput {
  write(text: string): void;
  writeLine(text: string): void;
  error(text: string): void;
  table(headers: string[], rows: string[][]): void;
  json(data: unknown): void;
}
