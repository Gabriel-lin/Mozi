export interface CliArg {
  name: string;
  alias?: string;
  description: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  defaultValue?: unknown;
}

export interface CliCommand {
  name: string;
  description: string;
  args?: CliArg[];
  options?: CliArg[];
  subcommands?: CliCommand[];
  handler: (parsed: ParsedArgs) => unknown | Promise<unknown>;
}

export interface ParsedArgs {
  command: string;
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  raw: string[];
}

export interface CliOutput {
  write(text: string): void;
  writeLine(text: string): void;
  error(text: string): void;
  table(headers: string[], rows: string[][]): void;
  json(data: unknown): void;
}
