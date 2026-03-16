import { CliError, ErrorCode } from "../errors";
import type { CliArg, CliCommand, ParsedArgs } from "./types";

export function parseArgs(tokens: string[], command: CliCommand): ParsedArgs {
  const parsed: ParsedArgs = {
    command: command.name,
    args: {},
    options: {},
    raw: tokens,
  };

  const args = command.args ?? [];
  const options = command.options ?? [];
  let argIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const eqIdx = key.indexOf("=");

      if (eqIdx !== -1) {
        const name = key.slice(0, eqIdx);
        const value = key.slice(eqIdx + 1);
        const opt = options.find((o) => o.name === name);
        parsed.options[name] = opt ? coerce(value, opt.type) : value;
      } else {
        const opt = options.find((o) => o.name === key);
        if (opt?.type === "boolean") {
          parsed.options[key] = true;
        } else if (i + 1 < tokens.length) {
          i++;
          parsed.options[key] = opt ? coerce(tokens[i], opt.type) : tokens[i];
        } else {
          parsed.options[key] = true;
        }
      }
    } else if (token.startsWith("-") && token.length === 2) {
      const alias = token.slice(1);
      const opt = options.find((o) => o.alias === alias);
      const name = opt?.name ?? alias;

      if (opt?.type === "boolean") {
        parsed.options[name] = true;
      } else if (i + 1 < tokens.length) {
        i++;
        parsed.options[name] = opt ? coerce(tokens[i], opt.type) : tokens[i];
      } else {
        parsed.options[name] = true;
      }
    } else {
      if (argIndex < args.length) {
        const argDef = args[argIndex];
        parsed.args[argDef.name] = coerce(token, argDef.type);
        argIndex++;
      } else {
        parsed.args[`_${argIndex}`] = token;
        argIndex++;
      }
    }
  }

  for (const opt of options) {
    if (!(opt.name in parsed.options) && opt.defaultValue !== undefined) {
      parsed.options[opt.name] = opt.defaultValue;
    }
  }

  for (const arg of args) {
    if (arg.required && !(arg.name in parsed.args)) {
      throw new CliError(`缺少必需参数: ${arg.name}`, { code: ErrorCode.CLI_ARG_INVALID });
    }
    if (!(arg.name in parsed.args) && arg.defaultValue !== undefined) {
      parsed.args[arg.name] = arg.defaultValue;
    }
  }

  return parsed;
}

function coerce(value: string, type: CliArg["type"]): unknown {
  switch (type) {
    case "number": {
      const n = Number(value);
      if (isNaN(n)) throw new CliError(`无效数字: ${value}`, { code: ErrorCode.CLI_ARG_INVALID });
      return n;
    }
    case "boolean":
      return value === "true" || value === "1" || value === "yes";
    default:
      return value;
  }
}

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}
