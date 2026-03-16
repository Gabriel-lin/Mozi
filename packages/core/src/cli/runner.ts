import { CliError, ErrorCode } from "../errors";
import { Logger } from "../logger";
import { parseArgs, tokenize } from "./parser";
import type { CliCommand, CliOutput } from "./types";

export class DefaultOutput implements CliOutput {
  private lines: string[] = [];

  write(text: string): void {
    this.lines.push(text);
  }

  writeLine(text: string): void {
    this.lines.push(text + "\n");
  }

  error(text: string): void {
    this.lines.push(`[ERROR] ${text}\n`);
  }

  table(headers: string[], rows: string[][]): void {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
    );

    const sep = widths.map((w) => "─".repeat(w + 2)).join("┼");
    const header = headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join("│");

    this.writeLine(header);
    this.writeLine(sep);
    for (const row of rows) {
      const line = row.map((c, i) => ` ${(c ?? "").padEnd(widths[i])} `).join("│");
      this.writeLine(line);
    }
  }

  json(data: unknown): void {
    this.writeLine(JSON.stringify(data, null, 2));
  }

  getOutput(): string {
    return this.lines.join("");
  }

  clear(): void {
    this.lines = [];
  }
}

export class CliRunner {
  private commands = new Map<string, CliCommand>();
  private logger: Logger;
  private output: CliOutput;

  constructor(output?: CliOutput, logger?: Logger) {
    this.output = output ?? new DefaultOutput();
    this.logger = logger ?? new Logger({ module: "cli" });
  }

  register(command: CliCommand): void {
    this.commands.set(command.name, command);
  }

  unregister(name: string): boolean {
    return this.commands.delete(name);
  }

  async execute(input: string): Promise<unknown> {
    const tokens = tokenize(input);
    if (tokens.length === 0) {
      throw new CliError("命令为空", { code: ErrorCode.CLI_PARSE });
    }

    const commandName = tokens[0];

    if (commandName === "help") {
      this.showHelp(tokens[1]);
      return;
    }

    const command = this.resolveCommand(tokens);
    if (!command) {
      throw new CliError(`未知命令: ${commandName}`, { code: ErrorCode.CLI_COMMAND_NOT_FOUND });
    }

    const cmdTokens = tokens.slice(this.getCommandDepth(tokens));
    const parsed = parseArgs(cmdTokens, command.command);

    this.logger.debug(`执行命令: ${command.command.name}`, { args: parsed.args, options: parsed.options });

    try {
      return await command.command.handler(parsed);
    } catch (error) {
      this.output.error((error as Error).message);
      throw error;
    }
  }

  showHelp(commandName?: string): void {
    if (commandName) {
      const cmd = this.commands.get(commandName);
      if (!cmd) {
        this.output.error(`未知命令: ${commandName}`);
        return;
      }
      this.output.writeLine(`\n  ${cmd.name} — ${cmd.description}\n`);

      if (cmd.args?.length) {
        this.output.writeLine("  参数:");
        for (const arg of cmd.args) {
          const req = arg.required ? "(必需)" : `(默认: ${arg.defaultValue ?? "无"})`;
          this.output.writeLine(`    ${arg.name}  ${arg.description}  ${req}`);
        }
      }
      if (cmd.options?.length) {
        this.output.writeLine("  选项:");
        for (const opt of cmd.options) {
          const alias = opt.alias ? `-${opt.alias}, ` : "    ";
          this.output.writeLine(`    ${alias}--${opt.name}  ${opt.description}`);
        }
      }
      if (cmd.subcommands?.length) {
        this.output.writeLine("  子命令:");
        for (const sub of cmd.subcommands) {
          this.output.writeLine(`    ${sub.name}  ${sub.description}`);
        }
      }
      return;
    }

    this.output.writeLine("\n  可用命令:\n");
    for (const cmd of this.commands.values()) {
      this.output.writeLine(`    ${cmd.name.padEnd(20)} ${cmd.description}`);
    }
    this.output.writeLine("\n  输入 help <command> 查看详细帮助\n");
  }

  listCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  private resolveCommand(tokens: string[]): { command: CliCommand; depth: number } | null {
    const rootCmd = this.commands.get(tokens[0]);
    if (!rootCmd) return null;

    let current = rootCmd;
    let depth = 1;

    for (let i = 1; i < tokens.length; i++) {
      const sub = current.subcommands?.find((s) => s.name === tokens[i]);
      if (sub) {
        current = sub;
        depth++;
      } else {
        break;
      }
    }

    return { command: current, depth };
  }

  private getCommandDepth(tokens: string[]): number {
    const resolved = this.resolveCommand(tokens);
    return resolved?.depth ?? 1;
  }
}
