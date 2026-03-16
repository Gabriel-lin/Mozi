import { LogLevel, LOG_LEVEL_NAMES, type LogEntry, type LogTransport, type LogFormatter } from "./types";

export class DefaultFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const level = LOG_LEVEL_NAMES[entry.level] ?? "UNKNOWN";
    const mod = entry.module ? `[${entry.module}]` : "";
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
    return `${time} ${level.padEnd(5)} ${mod} ${entry.message}${data}`;
  }
}

export class ConsoleTransport implements LogTransport {
  readonly name = "console";
  private formatter: LogFormatter;

  constructor(formatter?: LogFormatter) {
    this.formatter = formatter ?? new DefaultFormatter();
  }

  write(entry: LogEntry): void {
    const msg = this.formatter.format(entry);
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(msg);
        break;
      case LogLevel.INFO:
        console.info(msg);
        break;
      case LogLevel.WARN:
        console.warn(msg);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(msg, entry.error ?? "");
        break;
    }
  }
}

export class MemoryTransport implements LogTransport {
  readonly name = "memory";
  private entries: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  write(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  getEntries(): ReadonlyArray<LogEntry> {
    return this.entries;
  }

  query(filter: {
    level?: LogLevel;
    module?: string;
    from?: number;
    to?: number;
    limit?: number;
  }): LogEntry[] {
    let result = this.entries.slice();

    if (filter.level !== undefined) {
      result = result.filter((e) => e.level >= filter.level!);
    }
    if (filter.module) {
      result = result.filter((e) => e.module === filter.module);
    }
    if (filter.from) {
      result = result.filter((e) => e.timestamp >= filter.from!);
    }
    if (filter.to) {
      result = result.filter((e) => e.timestamp <= filter.to!);
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  clear(): void {
    this.entries = [];
  }
}

export class BatchTransport implements LogTransport {
  readonly name: string;
  private buffer: LogEntry[] = [];
  private batchSize: number;
  private flushInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onFlush: (entries: LogEntry[]) => void | Promise<void>;

  constructor(options: {
    name?: string;
    batchSize?: number;
    flushIntervalMs?: number;
    onFlush: (entries: LogEntry[]) => void | Promise<void>;
  }) {
    this.name = options.name ?? "batch";
    this.batchSize = options.batchSize ?? 50;
    this.flushInterval = options.flushIntervalMs ?? 5000;
    this.onFlush = options.onFlush;
    this.startTimer();
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    await this.onFlush(batch);
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    void this.flush();
  }

  private startTimer(): void {
    this.timer = setInterval(() => void this.flush(), this.flushInterval);
  }
}
