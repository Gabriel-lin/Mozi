import { Command } from "commander";
import chalk from "chalk";
import { CliError } from "../errors";
import {
  registerCreateCommand,
  registerExecCommand,
  registerRunCommand,
  registerListCommand,
} from "./commands";
import type { CustomCommandConfig } from "./types";
import { ui } from "./utils";

export function createProgram(version = "0.1.0"): Command {
  const program = new Command();

  program
    .name("mozi")
    .description("Mozi — 智能体、工作流与技能编排平台")
    .version(version, "-v, --version", "显示版本号")
    .helpOption("-h, --help", "显示帮助信息")
    .configureHelp({
      sortSubcommands: true,
      subcommandTerm: (cmd) => cmd.name(),
    })
    .addHelpText("beforeAll", ui.banner());

  registerCreateCommand(program);
  registerExecCommand(program);
  registerRunCommand(program);
  registerListCommand(program);

  program.on("command:*", (operands) => {
    console.error(ui.error(`未知命令: ${operands[0]}`));
    console.log(chalk.dim("  运行 mozi --help 查看可用命令\n"));
    process.exitCode = 1;
  });

  return program;
}

export function registerCustomCommand(program: Command, config: CustomCommandConfig): Command {
  const cmd = program.command(config.name).description(config.description);

  if (config.aliases) {
    for (const alias of config.aliases) {
      cmd.alias(alias);
    }
  }

  if (config.args) {
    for (const arg of config.args) {
      const notation = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
      cmd.argument(notation, arg.description, arg.defaultValue);
    }
  }

  if (config.options) {
    for (const opt of config.options) {
      cmd.option(opt.flags, opt.description, opt.defaultValue as string);
    }
  }

  cmd.action(async (...actionArgs: unknown[]) => {
    actionArgs.pop(); // Command instance
    const opts = (actionArgs.pop() ?? {}) as Record<string, unknown>;

    const args: Record<string, unknown> = {};
    if (config.args) {
      config.args.forEach((argDef, i) => {
        if (i < actionArgs.length) {
          args[argDef.name] = actionArgs[i];
        }
      });
    }

    try {
      await config.handler(args, opts);
    } catch (error) {
      if (error instanceof CliError) {
        console.error(ui.error(error.message));
      } else {
        console.error(ui.error((error as Error).message));
      }
      process.exitCode = 1;
    }
  });

  return cmd;
}

export async function runProgram(argv?: string[]): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv ?? process.argv);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(ui.error(error.message));
      if (error.code) {
        console.error(chalk.dim(`  错误码: ${error.code}`));
      }
    } else if (error instanceof Error) {
      console.error(ui.error(error.message));
    }
    process.exitCode = 1;
  }
}
