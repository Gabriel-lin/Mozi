import chalk from "chalk";
import Enquirer from "enquirer";
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { GeneratedFile, TemplateVariable } from "./types";

// ── Chalk 格式化工具 ─────────────────────────────────────────────────────────

export const ui = {
  title: (text: string) => chalk.bold.cyan(text),
  success: (text: string) => chalk.green(`✓ ${text}`),
  error: (text: string) => chalk.red(`✗ ${text}`),
  warn: (text: string) => chalk.yellow(`⚠ ${text}`),
  info: (text: string) => chalk.blue(`ℹ ${text}`),
  dim: (text: string) => chalk.dim(text),
  label: (text: string) => chalk.bold(text),
  highlight: (text: string) => chalk.cyan(text),
  code: (text: string) => chalk.gray(`\`${text}\``),

  banner() {
    const lines = [
      "",
      chalk.cyan("  ╔══════════════════════════════════╗"),
      chalk.cyan("  ║") + chalk.bold.white("   M O Z I  —  智能编排平台   ") + chalk.cyan("║"),
      chalk.cyan("  ╚══════════════════════════════════╝"),
      "",
    ];
    return lines.join("\n");
  },

  heading(text: string) {
    console.log();
    console.log(chalk.bold.underline(text));
    console.log();
  },

  divider() {
    console.log(chalk.dim("─".repeat(50)));
  },

  keyValue(entries: Array<[string, string]>, indent = 2) {
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    for (const [key, value] of entries) {
      const pad = " ".repeat(indent);
      console.log(`${pad}${chalk.bold(key.padEnd(maxKeyLen))}  ${chalk.dim(value)}`);
    }
  },

  table(headers: string[], rows: string[][]) {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
    );

    const sep = widths.map((w) => chalk.dim("─".repeat(w + 2))).join(chalk.dim("┼"));
    const header = headers
      .map((h, i) => ` ${chalk.bold(h.padEnd(widths[i]))} `)
      .join(chalk.dim("│"));

    console.log(header);
    console.log(sep);
    for (const row of rows) {
      const line = row
        .map((c, i) => ` ${(c ?? "").padEnd(widths[i])} `)
        .join(chalk.dim("│"));
      console.log(line);
    }
  },
};

// ── Enquirer 交互封装 ────────────────────────────────────────────────────────

const enquirer = new Enquirer();

export async function promptInput(message: string, initial?: string): Promise<string> {
  const response = await enquirer.prompt({
    type: "input",
    name: "value",
    message,
    initial,
  } as any);
  return (response as Record<string, string>).value;
}

export async function promptSelect(message: string, choices: string[]): Promise<string> {
  const response = await enquirer.prompt({
    type: "select",
    name: "value",
    message,
    choices,
  } as any);
  return (response as Record<string, string>).value;
}

export async function promptConfirm(message: string, initial = true): Promise<boolean> {
  const response = await enquirer.prompt({
    type: "confirm",
    name: "value",
    message,
    initial,
  } as any);
  return (response as Record<string, boolean>).value;
}

export async function promptNumber(message: string, initial?: number): Promise<number> {
  const response = await enquirer.prompt({
    type: "numeral",
    name: "value",
    message,
    initial,
  } as any);
  return Number((response as Record<string, unknown>).value);
}

export async function promptVariables(
  variables: TemplateVariable[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  for (const v of variables) {
    if (v.type === "select" && v.choices?.length) {
      result[v.name] = await promptSelect(v.description, v.choices);
    } else if (v.type === "boolean") {
      result[v.name] = await promptConfirm(v.description, (v.default as boolean) ?? true);
    } else if (v.type === "number") {
      result[v.name] = await promptNumber(v.description, v.default as number);
    } else {
      result[v.name] = await promptInput(v.description, v.default as string);
    }
  }

  return result;
}

// ── 文件系统工具 ─────────────────────────────────────────────────────────────

export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function writeGeneratedFiles(
  files: GeneratedFile[],
  baseDir: string,
  force = false,
): Promise<string[]> {
  const written: string[] = [];

  for (const file of files) {
    const fullPath = resolve(baseDir, file.path);

    if (!force && (await pathExists(fullPath))) {
      console.log(ui.warn(`文件已存在，跳过: ${file.path}`));
      continue;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, "utf-8");
    written.push(file.path);
    console.log(ui.success(`创建: ${file.path}`));
  }

  return written;
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
