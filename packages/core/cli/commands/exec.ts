import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { CliError, ErrorCode } from "../../errors";
import { ExecOptionsSchema } from "../types";
import { ui, pathExists } from "../utils";

export function registerExecCommand(program: Command): void {
  program
    .command("exec")
    .description("执行外部命令或脚本")
    .argument("<script>", "脚本路径或命令")
    .argument("[args...]", "传递给脚本的参数")
    .option("-c, --cwd <dir>", "工作目录")
    .option("-t, --timeout <ms>", "超时时间 (毫秒)")
    .option("-s, --shell <shell>", "指定 shell (如 bash, zsh, sh)")
    .option("-e, --env <pairs...>", "环境变量 (格式: KEY=VALUE)")
    .option("--silent", "静默模式，不输出子进程的 stdout", false)
    .action(async (script: string, args: string[], opts: Record<string, unknown>) => {
      await handleExec(script, args, opts);
    })
    .addHelpText("after", [
      "",
      chalk.bold("示例:"),
      "  $ mozi exec ./scripts/build.sh",
      "  $ mozi exec python train.py --epochs 10",
      "  $ mozi exec node index.js -c /app --timeout 30000",
      "  $ mozi exec ./deploy.sh -e NODE_ENV=production PORT=3000",
      "",
    ].join("\n"));
}

async function handleExec(
  script: string,
  args: string[],
  opts: Record<string, unknown>,
): Promise<void> {
  const envPairs = parseEnvPairs(opts.env as string[] | undefined);
  const timeout = opts.timeout ? Number(opts.timeout) : undefined;
  const cwd = opts.cwd ? resolve(String(opts.cwd)) : process.cwd();
  const shell = opts.shell as string | undefined;
  const silent = Boolean(opts.silent);

  const validated = ExecOptionsSchema.parse({
    script,
    args,
    cwd,
    timeout,
    shell,
    env: Object.keys(envPairs).length > 0 ? envPairs : undefined,
  });

  console.log(ui.info(`执行: ${chalk.bold(script)} ${args.join(" ")}`));
  if (cwd !== process.cwd()) {
    console.log(ui.dim(`  工作目录: ${cwd}`));
  }
  if (timeout) {
    console.log(ui.dim(`  超时: ${timeout}ms`));
  }
  console.log();

  const exitCode = await runProcess({
    command: validated.script,
    args: validated.args ?? [],
    cwd: validated.cwd ?? process.cwd(),
    env: { ...process.env, ...envPairs },
    shell: validated.shell,
    timeout: validated.timeout,
    silent,
  });

  console.log();
  if (exitCode === 0) {
    console.log(ui.success("命令执行完成"));
  } else {
    console.log(ui.error(`命令退出，退出码: ${exitCode}`));
    process.exitCode = exitCode;
  }
}

interface RunProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  shell?: string;
  timeout?: number;
  silent?: boolean;
}

function runProcess(opts: RunProcessOptions): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const useShell = opts.shell ?? true;
    const proc = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: useShell,
      stdio: opts.silent ? ["inherit", "pipe", "pipe"] : "inherit",
    });

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (opts.timeout) {
      timer = setTimeout(() => {
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
        }, 5000);
        reject(
          new CliError(`命令超时 (${opts.timeout}ms)`, { code: ErrorCode.TIMEOUT }),
        );
      }, opts.timeout);
    }

    proc.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(new CliError(`无法执行命令: ${err.message}`, { code: ErrorCode.CLI }));
    });

    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolvePromise(code ?? 1);
    });
  });
}

function parseEnvPairs(pairs?: string[]): Record<string, string> {
  if (!pairs) return {};
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      result[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
    }
  }
  return result;
}
