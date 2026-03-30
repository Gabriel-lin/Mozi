import { Command } from "commander";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CliError, ErrorCode } from "../../errors";
import { RunOptionsSchema } from "../types";
import { ui, pathExists } from "../utils";

export function registerRunCommand(program: Command): void {
  const run = program
    .command("run")
    .description("运行智能体或工作流");

  run
    .command("agent")
    .description("运行智能体")
    .argument("<target>", "智能体名称或配置文件路径")
    .option("-g, --goal <text>", "智能体目标/任务")
    .option("-c, --config <file>", "配置文件路径 (JSON)")
    .option("-p, --params <json>", "运行参数 (JSON 字符串)")
    .option("--verbose", "详细输出", false)
    .option("--dry-run", "仅验证，不执行", false)
    .action(async (target: string, opts: Record<string, unknown>) => {
      await handleRunAgent(target, opts);
    });

  run
    .command("workflow")
    .description("运行工作流")
    .argument("<target>", "工作流名称或定义文件路径")
    .option("-c, --config <file>", "配置文件路径 (JSON)")
    .option("-p, --params <json>", "运行参数 (JSON 字符串)")
    .option("-d, --data <json>", "初始数据 (JSON 字符串)")
    .option("--verbose", "详细输出", false)
    .option("--dry-run", "仅验证，不执行", false)
    .action(async (target: string, opts: Record<string, unknown>) => {
      await handleRunWorkflow(target, opts);
    });

  run.addHelpText("after", [
    "",
    chalk.bold("示例:"),
    "  $ mozi run agent my-bot --goal \"分析这段文本\"",
    "  $ mozi run agent ./agents/react-bot/index.ts --verbose",
    "  $ mozi run workflow etl-pipeline --data '{\"source\": \"api\"}'",
    "  $ mozi run workflow ./workflows/my-flow.ts --config config.json",
    "",
  ].join("\n"));
}

async function handleRunAgent(target: string, opts: Record<string, unknown>): Promise<void> {
  const validated = RunOptionsSchema.parse({
    target,
    config: opts.config,
    params: opts.params,
    goal: opts.goal,
    verbose: opts.verbose,
    dryRun: opts.dryRun,
  });

  const goal = validated.goal ?? "";
  const verbose = Boolean(validated.verbose);
  const dryRun = Boolean(validated.dryRun);

  console.log(ui.info(`准备运行智能体: ${chalk.bold(target)}`));

  const config = await loadConfig(validated.config);
  const params = parseJsonParam(validated.params);

  if (verbose) {
    console.log(ui.dim("  配置:"), config ? chalk.dim(JSON.stringify(config)) : chalk.dim("无"));
    console.log(ui.dim("  参数:"), params ? chalk.dim(JSON.stringify(params)) : chalk.dim("无"));
    console.log(ui.dim("  目标:"), chalk.dim(goal || "无"));
  }

  if (dryRun) {
    console.log();
    console.log(ui.warn("Dry-run 模式，跳过执行"));
    printAgentSummary(target, goal, config, params);
    return;
  }

  const resolvedPath = resolve(target);
  if (await pathExists(resolvedPath)) {
    console.log(ui.info("从文件加载智能体配置..."));
    console.log(ui.dim(`  路径: ${resolvedPath}`));
  }

  console.log();
  console.log(ui.info("正在启动智能体..."));
  console.log(ui.dim("  请通过 API 调用 AgentFactory.create() 来实际运行智能体"));
  console.log(ui.dim("  或在代码中 import 并使用 ReActAgent"));

  printAgentSummary(target, goal, config, params);
}

async function handleRunWorkflow(target: string, opts: Record<string, unknown>): Promise<void> {
  const validated = RunOptionsSchema.parse({
    target,
    config: opts.config,
    params: opts.params,
    goal: opts.data as string,
    verbose: opts.verbose,
    dryRun: opts.dryRun,
  });

  const verbose = Boolean(validated.verbose);
  const dryRun = Boolean(validated.dryRun);

  console.log(ui.info(`准备运行工作流: ${chalk.bold(target)}`));

  const config = await loadConfig(validated.config);
  const params = parseJsonParam(validated.params);
  const data = parseJsonParam(validated.goal);

  if (verbose) {
    console.log(ui.dim("  配置:"), config ? chalk.dim(JSON.stringify(config)) : chalk.dim("无"));
    console.log(ui.dim("  参数:"), params ? chalk.dim(JSON.stringify(params)) : chalk.dim("无"));
    console.log(ui.dim("  数据:"), data ? chalk.dim(JSON.stringify(data)) : chalk.dim("无"));
  }

  if (dryRun) {
    console.log();
    console.log(ui.warn("Dry-run 模式，跳过执行"));
    printWorkflowSummary(target, config, params, data);
    return;
  }

  const resolvedPath = resolve(target);
  if (await pathExists(resolvedPath)) {
    console.log(ui.info("从文件加载工作流定义..."));
    console.log(ui.dim(`  路径: ${resolvedPath}`));
  }

  console.log();
  console.log(ui.info("正在启动工作流..."));
  console.log(ui.dim("  请通过 API 调用 WorkflowEngine.execute() 来实际运行工作流"));

  printWorkflowSummary(target, config, params, data);
}

async function loadConfig(configPath?: string): Promise<Record<string, unknown> | null> {
  if (!configPath) return null;
  const fullPath = resolve(configPath);

  if (!(await pathExists(fullPath))) {
    throw new CliError(`配置文件不存在: ${fullPath}`, { code: ErrorCode.NOT_FOUND });
  }

  const content = await readFile(fullPath, "utf-8");
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new CliError(`配置文件格式错误: ${fullPath}`, { code: ErrorCode.VALIDATION });
  }
}

function parseJsonParam(param?: string): Record<string, unknown> | null {
  if (!param) return null;
  try {
    return JSON.parse(param) as Record<string, unknown>;
  } catch {
    throw new CliError(`JSON 参数格式错误: ${param}`, { code: ErrorCode.VALIDATION });
  }
}

function printAgentSummary(
  target: string,
  goal: string,
  config: Record<string, unknown> | null,
  params: Record<string, unknown> | null,
): void {
  console.log();
  ui.heading("智能体运行摘要");
  ui.keyValue([
    ["目标", target],
    ["任务", goal || "(未指定)"],
    ["配置", config ? JSON.stringify(config) : "(默认)"],
    ["参数", params ? JSON.stringify(params) : "(无)"],
  ]);
}

function printWorkflowSummary(
  target: string,
  config: Record<string, unknown> | null,
  params: Record<string, unknown> | null,
  data: Record<string, unknown> | null,
): void {
  console.log();
  ui.heading("工作流运行摘要");
  ui.keyValue([
    ["工作流", target],
    ["配置", config ? JSON.stringify(config) : "(默认)"],
    ["参数", params ? JSON.stringify(params) : "(无)"],
    ["初始数据", data ? JSON.stringify(data) : "(无)"],
  ]);
}
