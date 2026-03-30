import { Command } from "commander";
import chalk from "chalk";
import { listTemplates, getTemplateNames } from "../templates";
import type { TemplateCategory } from "../types";
import { ui } from "../utils";

const CATEGORIES: TemplateCategory[] = ["agent", "workflow", "skill", "context"];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  agent: "智能体",
  workflow: "工作流",
  skill: "技能",
  context: "上下文",
};

export function registerListCommand(program: Command): void {
  const list = program
    .command("list")
    .description("列出可用资源与模板");

  list
    .command("templates")
    .description("列出所有可用模板")
    .option("-c, --category <type>", `按类型过滤: ${CATEGORIES.join(", ")}`)
    .option("--json", "以 JSON 格式输出", false)
    .action((opts: Record<string, unknown>) => {
      handleListTemplates(opts);
    });

  list
    .command("agents")
    .description("列出可用的智能体模板")
    .option("--json", "以 JSON 格式输出", false)
    .action((opts: Record<string, unknown>) => {
      handleListByCategory("agent", opts);
    });

  list
    .command("workflows")
    .description("列出可用的工作流模板")
    .option("--json", "以 JSON 格式输出", false)
    .action((opts: Record<string, unknown>) => {
      handleListByCategory("workflow", opts);
    });

  list
    .command("skills")
    .description("列出可用的技能模板")
    .option("--json", "以 JSON 格式输出", false)
    .action((opts: Record<string, unknown>) => {
      handleListByCategory("skill", opts);
    });

  list
    .command("contexts")
    .description("列出可用的上下文模板")
    .option("--json", "以 JSON 格式输出", false)
    .action((opts: Record<string, unknown>) => {
      handleListByCategory("context", opts);
    });
}

function handleListTemplates(opts: Record<string, unknown>): void {
  const category = opts.category as TemplateCategory | undefined;
  const asJson = Boolean(opts.json);

  const templates = listTemplates(category);

  if (asJson) {
    console.log(
      JSON.stringify(
        templates.map((t) => ({
          name: t.name,
          category: t.category,
          description: t.description,
          variables: t.variables,
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (templates.length === 0) {
    console.log(ui.warn("没有找到模板"));
    return;
  }

  console.log(ui.banner());
  console.log(chalk.bold("  可用模板\n"));

  if (category) {
    printCategoryTemplates(category, templates.map((t) => t.name));
  } else {
    for (const cat of CATEGORIES) {
      const catTemplates = templates.filter((t) => t.category === cat);
      if (catTemplates.length > 0) {
        printCategorySection(cat, catTemplates);
      }
    }
  }

  console.log();
  console.log(chalk.dim("  使用 mozi create <type> <name> --template <template> 创建资源"));
  console.log();
}

function handleListByCategory(category: TemplateCategory, opts: Record<string, unknown>): void {
  const asJson = Boolean(opts.json);
  const templates = listTemplates(category);

  if (asJson) {
    console.log(
      JSON.stringify(
        templates.map((t) => ({
          name: t.name,
          description: t.description,
          variables: t.variables.map((v) => ({
            name: v.name,
            type: v.type,
            required: v.required,
            default: v.default,
          })),
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (templates.length === 0) {
    console.log(ui.warn(`没有找到 ${CATEGORY_LABELS[category]} 模板`));
    return;
  }

  console.log();
  printCategorySection(category, templates);

  console.log();
  console.log(
    chalk.dim(`  使用 mozi create ${category} <name> --template <template> 创建 ${CATEGORY_LABELS[category]}`),
  );
  console.log();
}

function printCategorySection(
  category: TemplateCategory,
  templates: Array<{ name: string; description: string; variables: Array<{ name: string; type: string; required?: boolean }> }>,
): void {
  console.log(`  ${chalk.bold.cyan(CATEGORY_LABELS[category])} ${chalk.dim(`(${category})`)}`);
  console.log();

  const rows = templates.map((t) => {
    const varList = t.variables
      .map((v) => `${v.name}${v.required ? "*" : ""}`)
      .join(", ");
    return [t.name, t.description, varList || "-"];
  });

  ui.table(["模板", "描述", "参数"], rows);
  console.log();
}

function printCategoryTemplates(category: TemplateCategory, names: string[]): void {
  console.log(`  ${chalk.bold.cyan(CATEGORY_LABELS[category])}`);
  console.log();
  for (const name of names) {
    console.log(`    ${chalk.green("•")} ${name}`);
  }
  console.log();
}
