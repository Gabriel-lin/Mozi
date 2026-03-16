import { StorageError, ErrorCode } from "../../errors";
import { Logger } from "../../logger";
import { httpRequest } from "../http";
import {
  ConnectionStatus,
  DriverType,
  type ExecuteResult,
  type HttpRequestConfig,
  type QueryResult,
  type RelationalDriver,
  type TransactionContext,
} from "../types";

export interface PostgresConfig {
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  /** 如果通过 HTTP 代理访问（如 PostgREST / Supabase），设置 API 基础地址 */
  apiBaseUrl?: string;
  apiKey?: string;
  pool?: { min?: number; max?: number };
}

export class PostgreSQLDriver implements RelationalDriver {
  readonly driverType = DriverType.POSTGRESQL;
  private _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private config: PostgresConfig;
  private httpConfig: HttpRequestConfig;
  private logger: Logger;

  constructor(config: PostgresConfig) {
    this.config = config;
    this.httpConfig = {
      baseUrl: config.apiBaseUrl ?? `http://${config.host}:${config.port ?? 3000}`,
      headers: {
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        Prefer: "return=representation",
      },
      timeout: 30000,
    };
    this.logger = new Logger({ module: "storage:postgresql" });
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this._status = ConnectionStatus.CONNECTING;
    try {
      await this.healthCheck();
      this._status = ConnectionStatus.CONNECTED;
      this.logger.info("PostgreSQL 已连接", {
        host: this.config.host,
        database: this.config.database,
      });
    } catch (error) {
      this._status = ConnectionStatus.ERROR;
      throw new StorageError("postgresql", `连接失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_CONNECTION,
        cause: error as Error,
      });
    }
  }

  async disconnect(): Promise<void> {
    this._status = ConnectionStatus.DISCONNECTED;
    this.logger.info("PostgreSQL 已断开");
  }

  isConnected(): boolean {
    return this._status === ConnectionStatus.CONNECTED;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await httpRequest(this.httpConfig, "/");
      return true;
    } catch {
      return false;
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.ensureConnected();
    try {
      const result = await httpRequest<{ rows: T[]; fields?: string[] }>(
        this.httpConfig,
        "/rpc/query",
        { method: "POST", body: { sql, params: params ?? [] } },
      );
      return {
        rows: result.rows ?? [],
        rowCount: (result.rows ?? []).length,
        fields: result.fields ?? [],
      };
    } catch (error) {
      throw new StorageError("postgresql", `查询失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_QUERY,
        cause: error as Error,
        metadata: { sql },
      });
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
    this.ensureConnected();
    try {
      const result = await httpRequest<{ affected_rows: number; last_insert_id?: string }>(
        this.httpConfig,
        "/rpc/execute",
        { method: "POST", body: { sql, params: params ?? [] } },
      );
      return {
        affectedRows: result.affected_rows ?? 0,
        lastInsertId: result.last_insert_id,
      };
    } catch (error) {
      throw new StorageError("postgresql", `执行失败: ${(error as Error).message}`, {
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
      await this.execute("BEGIN");
      const result = await fn(txCtx);
      await this.execute("COMMIT");
      return result;
    } catch (error) {
      await this.execute("ROLLBACK").catch(() => {});
      throw new StorageError("postgresql", `事务失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_TRANSACTION,
        cause: error as Error,
      });
    }
  }

  async tableExists(table: string): Promise<boolean> {
    const result = await this.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
      [table],
    );
    return result.rows[0]?.exists ?? false;
  }

  async listTables(): Promise<string[]> {
    const result = await this.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    return result.rows.map((r) => r.table_name);
  }

  private ensureConnected(): void {
    if (this._status !== ConnectionStatus.CONNECTED) {
      throw new StorageError("postgresql", "未连接数据库", { code: ErrorCode.STORAGE_CONNECTION });
    }
  }
}
