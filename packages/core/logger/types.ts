export enum LogLevel {
  TRACE = 0,
  DEBUG = 10,
  INFO = 20,
  WARN = 30,
  ERROR = 40,
  FATAL = 50,
  SILENT = 100,
}

export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.TRACE]: "TRACE",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.FATAL]: "FATAL",
  [LogLevel.SILENT]: "SILENT",
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  module?: string;
  data?: Record<string, unknown>;
  error?: Error;
}

export interface LogTransport {
  readonly name: string;
  write(entry: LogEntry): void;
  flush?(): void | Promise<void>;
}

export interface LogFormatter {
  format(entry: LogEntry): string;
}

export interface LoggerOptions {
  level?: LogLevel;
  module?: string;
  transports?: LogTransport[];
  context?: Record<string, unknown>;
}
