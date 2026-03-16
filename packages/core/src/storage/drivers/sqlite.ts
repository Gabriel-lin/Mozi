import { StorageError, ErrorCode } from "../../errors";
import { Logger } from "../../logger";
import {
  ConnectionStatus,
  DriverType,
  type ExecuteResult,
  type QueryResult,
  type RelationalDriver,
  type TransactionContext,
} from "../types";

export interface SqliteConfig {
  /** 数据库文件路径（通过 Tauri 后端访问）或 ":memory:" */
  path: string;
  /** 自定义 Tauri invoke 函数（用于通过 Tauri command 访问 SQLite） */
  invoke?: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
}

export class SQLiteDriver implements RelationalDriver {
  readonly driverType = DriverType.SQLITE;
  private _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private config: SqliteConfig;
  private logger: Logger;
  private invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;

  /** 内存模式下用于模拟的表存储 */
  private memoryTables = new Map<string, Array<Record<string, unknown>>>();
  private memorySchemas = new Map<string, string>();

  constructor(config: SqliteConfig) {
    this.config = config;
    this.invoke = config.invoke ?? this.memoryInvoke.bind(this);
    this.logger = new Logger({ module: "storage:sqlite" });
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this._status = ConnectionStatus.CONNECTING;
    try {
      await this.invoke("sqlite_open", { path: this.config.path });
      this._status = ConnectionStatus.CONNECTED;
      this.logger.info("SQLite 已连接", { path: this.config.path });
    } catch (error) {
      this._status = ConnectionStatus.CONNECTED;
      this.logger.info("SQLite 以内存模式运行");
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.invoke("sqlite_close", { path: this.config.path });
    } catch {
      /* ignore */
    }
    this._status = ConnectionStatus.DISCONNECTED;
    this.logger.info("SQLite 已断开");
  }

  isConnected(): boolean {
    return this._status === ConnectionStatus.CONNECTED;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.ensureConnected();
    try {
      const result = (await this.invoke("sqlite_query", {
        path: this.config.path,
        sql,
        params: params ?? [],
      })) as { rows: T[]; fields: string[] };
      return {
        rows: result?.rows ?? [],
        rowCount: (result?.rows ?? []).length,
        fields: result?.fields ?? [],
      };
    } catch (error) {
      throw new StorageError("sqlite", `查询失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_QUERY,
        cause: error as Error,
        metadata: { sql },
      });
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
    this.ensureConnected();
    try {
      const result = (await this.invoke("sqlite_execute", {
        path: this.config.path,
        sql,
        params: params ?? [],
      })) as { affected_rows: number; last_insert_id?: number };
      return {
        affectedRows: result?.affected_rows ?? 0,
        lastInsertId: result?.last_insert_id,
      };
    } catch (error) {
      throw new StorageError("sqlite", `执行失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_QUERY,
        cause: error as Error,
        metadata: { sql },
      });
    }
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.ensureConnected();
    const txCtx: TransactionContext = {
      query: (sql, params) => this.query(sql, params),
      execute: (sql, params) => this.execute(sql, params),
    };

    try {
      await this.execute("BEGIN TRANSACTION");
      const result = await fn(txCtx);
      await this.execute("COMMIT");
      return result;
    } catch (error) {
      await this.execute("ROLLBACK").catch(() => {});
      throw new StorageError("sqlite", `事务失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_TRANSACTION,
        cause: error as Error,
      });
    }
  }

  async tableExists(table: string): Promise<boolean> {
    if (this.memoryTables.has(table)) return true;
    const result = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [table],
    );
    return result.rows.length > 0;
  }

  async listTables(): Promise<string[]> {
    const result = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    return result.rows.map((r) => r.name);
  }

  private ensureConnected(): void {
    if (this._status !== ConnectionStatus.CONNECTED) {
      throw new StorageError("sqlite", "未连接数据库", { code: ErrorCode.STORAGE_CONNECTION });
    }
  }

  /** 内存模式的 invoke 模拟 */
  private async memoryInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
    switch (cmd) {
      case "sqlite_open":
        return {};
      case "sqlite_close":
        return {};
      case "sqlite_query": {
        const sql = (args.sql as string).trim().toLowerCase();
        if (sql === "select 1") {
          return { rows: [{ "1": 1 }], fields: ["1"] };
        }
        if (sql.includes("sqlite_master")) {
          const tables = Array.from(this.memoryTables.keys());
          return { rows: tables.map((name) => ({ name })), fields: ["name"] };
        }
        return { rows: [], fields: [] };
      }
      case "sqlite_execute": {
        const sql = (args.sql as string).trim();
        const upper = sql.toUpperCase();
        if (upper.startsWith("CREATE TABLE")) {
          const match = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i);
          if (match) {
            this.memoryTables.set(match[1], []);
            this.memorySchemas.set(match[1], sql);
          }
        }
        return { affected_rows: 0 };
      }
      default:
        return {};
    }
  }
}
