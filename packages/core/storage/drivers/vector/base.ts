import { StorageError, ErrorCode } from "../../../errors";
import { Logger } from "../../../logger";
import { httpRequest } from "../../http";
import {
  ConnectionStatus,
  type HttpRequestConfig,
  type VectorCollectionConfig,
  type VectorDriver,
  type VectorRecord,
  type VectorSearchQuery,
  type VectorSearchResult,
  type DriverType,
} from "../../types";

/**
 * 向量数据库的抽象基类
 *
 * 子类只需实现 buildXxxRequest / parseXxxResponse 等协议适配方法。
 * 连接管理、错误处理、日志统一由基类完成。
 */
export abstract class BaseVectorDriver implements VectorDriver {
  abstract readonly driverType: DriverType;
  protected _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  protected httpConfig: HttpRequestConfig;
  protected logger: Logger;

  constructor(httpConfig: HttpRequestConfig, driverName: string) {
    this.httpConfig = httpConfig;
    this.logger = new Logger({ module: `storage:${driverName}` });
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this._status = ConnectionStatus.CONNECTING;
    try {
      const ok = await this.healthCheck();
      this._status = ok ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR;
      if (ok) this.logger.info("向量数据库已连接");
    } catch (error) {
      this._status = ConnectionStatus.ERROR;
      throw new StorageError(this.driverType, `连接失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_CONNECTION,
        cause: error as Error,
      });
    }
  }

  async disconnect(): Promise<void> {
    this._status = ConnectionStatus.DISCONNECTED;
    this.logger.info("向量数据库已断开");
  }

  isConnected(): boolean {
    return this._status === ConnectionStatus.CONNECTED;
  }

  abstract healthCheck(): Promise<boolean>;
  abstract createCollection(name: string, config: VectorCollectionConfig): Promise<void>;
  abstract deleteCollection(name: string): Promise<void>;
  abstract collectionExists(name: string): Promise<boolean>;
  abstract listCollections(): Promise<string[]>;
  abstract upsert(collection: string, vectors: VectorRecord[]): Promise<void>;
  abstract search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  abstract deleteVectors(collection: string, ids: string[]): Promise<void>;
  abstract getVector(collection: string, id: string): Promise<VectorRecord | null>;

  protected ensureConnected(): void {
    if (this._status !== ConnectionStatus.CONNECTED) {
      throw new StorageError(this.driverType, "未连接", { code: ErrorCode.STORAGE_CONNECTION });
    }
  }

  protected async request<T = unknown>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
    return httpRequest<T>(this.httpConfig, path, options);
  }
}
