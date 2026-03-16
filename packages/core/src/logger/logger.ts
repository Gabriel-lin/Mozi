import { LogLevel, type LogEntry, type LogTransport, type LoggerOptions } from "./types";
import { ConsoleTransport } from "./transport";

export class Logger {
  private level: LogLevel;
  private module?: string;
  private transports: LogTransport[];
  private context: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.module = options.module;
    this.transports = options.transports ?? [new ConsoleTransport()];
    this.context = options.context ?? {};
  }

  child(options: { module?: string; context?: Record<string, unknown> }): Logger {
    return new Logger({
      level: this.level,
      module: options.module ?? this.module,
      transports: this.transports,
      context: { ...this.context, ...options.context },
    });
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  removeTransport(name: string): void {
    this.transports = this.transports.filter((t) => t.name !== name);
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, { ...data }, error);
  }

  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, { ...data }, error);
  }

  async flush(): Promise<void> {
    for (const transport of this.transports) {
      if (transport.flush) await transport.flush();
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      module: this.module,
      data: Object.keys(this.context).length > 0 || data ? { ...this.context, ...data } : undefined,
      error,
    };

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch {
        // transport 失败不应中断日志系统
      }
    }
  }
}

export const logger = new Logger();
