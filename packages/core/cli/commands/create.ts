import { Command } from "commander";
import chalk from "chalk";
import { z } from "zod";
import { CliError, ErrorCode } from "../../errors";
import { getTemplate, getTemplateNames, listTemplates } from "../templates";
import { CreateOptionsSchema, type TemplateCategory } from "../types";
import {
  ui,
  promptInput,
  promptSelect,
  promptConfirm,
  promptVariables,
  writeGeneratedFiles,
  toKebabCase,
} from "../utils";

const CATEGORIES: TemplateCategory[] = ["agent", "workflow", "skill", "context"];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  agent: "智能体 (Agent)",
  workflow: "工作流 (Workflow)",
  skill: "技能 (Skill)",
  context: "上下文 (Context)",
};

export function registerCreateCommand(program: Command): void {
  const create = program
    .command("create")
    .description("创建智能体、工作流、技能或上下文")
    .argument("<type>", `资源类型: ${CATEGORIES.join(", ")}`)
    .argument("[name]", "资源名称")
    .option("-t, --template <name>", "使用指定模板")
    .option("-o, --output <dir>", "输出目录", ".")
    .option("-d, --description <text>", "资源描述")
    .option("-i, --interactive", "交互式模式", false)
    .option("-f, --force", "覆盖已存在的文件", false)
    .action(async (type: string, name: string | undefined, opts: Record<string, unknown>) => {
      await handleCreate(type, name, opts);
    });

  create.addHelpText("after", () => {
    const lines = [
      "",
      chalk.bold("示例:"),
      `  $ mozi create agent my-bot --template react`,
      `  $ mozi create workflow etl-pipeline --template pipeline`,
      `  $ mozi create skill web-search --template api`,
      `  $ mozi create context chat-ctx --template conversation -i`,
      "",
      chalk.bold("可用模板:"),
    ];
    for (const cat of CATEGORIES) {
      const templates = getTemplateNames(cat);
      lines.push(`  ${CATEGORY_LABELS[cat]}: ${templates.join(", ")}`);
    }
    return lines.join("\n");
  });
}

async function handleCreate(
  type: string,
  rawName: string | undefined,
  opts: Record<string, unknown>,
): Promise<void> {
  const category = validateCategory(type);
  const isInteractive = Boolean(opts.interactive) || !rawName;

  let name = rawName;
  let templateName = opts.template as string | undefined;
  let description = opts.description as string | undefined;

  if (isInteractive) {
    name = name ?? (await promptInput(`${CATEGORY_LABELS[category]}名称`, "my-" + category));

    const templates = listTemplates(category);
    const choices = templates.map((t) => `${t.name} — ${t.description}`);
    if (!templateName && templates.length > 0) {
      const selected = await promptSelect("选择模板", choices);
      templateName = selected.split(" — ")[0];
    }

    if (!description) {
      description = await promptInput("描述 (可留空)", "");
    }
  }

  if (!name) {
    throw new CliError("请提供名称", { code: ErrorCode.CLI_ARG_INVALID });
  }

  const validated = CreateOptionsSchema.parse({
    name,
    template: templateName,
    output: opts.output,
    interactive: isInteractive,
    force: opts.force,
    description,
  });

  templateName = validated.template ?? "basic";
  const template = getTemplate(category, templateName);
  if (!template) {
    const available = getTemplateNames(category).join(", ");
    console.log(ui.error(`未找到模板 "${templateName}"`));
    console.log(ui.info(`可用的 ${CATEGORY_LABELS[category]} 模板: ${available}`));
    return;
  }

  console.log();
  console.log(ui.info(`正在创建 ${CATEGORY_LABELS[category]}: ${chalk.bold(name)}`));
  console.log(ui.dim(`  模板: ${templateName}`));
  console.log(ui.dim(`  输出: ${validated.output ?? "."}`));

  let vars: Record<string, unknown> = {
    name,
    description: validated.description ?? "",
  };

  if (isInteractive) {
    const nonNameVars = template.variables.filter(
      (v) => v.name !== "name" && v.name !== "description",
    );
    if (nonNameVars.length > 0) {
      const extra = await promptVariables(nonNameVars);
      vars = { ...vars, ...extra };
    }
  }

  const files = template.render(vars);
  const outputDir = validated.output ?? ".";

  if (!validated.force) {
    const proceed = isInteractive
      ? await promptConfirm(`将生成 ${files.length} 个文件，继续?`)
      : true;
    if (!proceed) {
      console.log(ui.warn("已取消"));
      return;
    }
  }

  const written = await writeGeneratedFiles(files, outputDir, validated.force);

  console.log();
  if (written.length > 0) {
    console.log(ui.success(`成功创建 ${written.length} 个文件`));
    console.log();
    console.log(chalk.dim("  下一步:"));
    console.log(chalk.dim(`  cd ${toKebabCase(name)} && 开始编辑`));
  } else {
    console.log(ui.warn("没有文件被创建"));
  }
}

function validateCategory(type: string): TemplateCategory {
  if (CATEGORIES.includes(type as TemplateCategory)) {
    return type as TemplateCategory;
  }
  const available = CATEGORIES.map((c) => `${c} (${CATEGORY_LABELS[c]})`).join("\n  ");
  throw new CliError(`无效的资源类型: "${type}"\n\n  可用类型:\n  ${available}`, {
    code: ErrorCode.CLI_ARG_INVALID,
  });
}
