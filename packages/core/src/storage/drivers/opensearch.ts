import { StorageError, ErrorCode } from "../../errors";
import { Logger } from "../../logger";
import { httpRequest } from "../http";
import {
  ConnectionStatus,
  DriverType,
  type BulkResult,
  type HttpRequestConfig,
  type IndexMapping,
  type SearchDriver,
  type SearchQuery,
  type SearchResult,
} from "../types";

export interface OpenSearchConfig {
  nodes: string[];
  auth?: { username: string; password: string };
  apiKey?: string;
  ssl?: boolean;
  timeout?: number;
}

export class OpenSearchDriver implements SearchDriver {
  readonly driverType = DriverType.OPENSEARCH;
  private _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private httpConfig: HttpRequestConfig;
  private logger: Logger;

  constructor(config: OpenSearchConfig) {
    const baseUrl = config.nodes[0] ?? "http://localhost:9200";
    const headers: Record<string, string> = {};

    if (config.auth) {
      headers.Authorization = `Basic ${btoa(`${config.auth.username}:${config.auth.password}`)}`;
    } else if (config.apiKey) {
      headers.Authorization = `ApiKey ${config.apiKey}`;
    }

    this.httpConfig = { baseUrl, headers, timeout: config.timeout ?? 30000 };
    this.logger = new Logger({ module: "storage:opensearch" });
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this._status = ConnectionStatus.CONNECTING;
    try {
      const ok = await this.healthCheck();
      this._status = ok ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR;
      if (ok) this.logger.info("OpenSearch 已连接");
    } catch (error) {
      this._status = ConnectionStatus.ERROR;
      throw new StorageError("opensearch", `连接失败: ${(error as Error).message}`, {
        code: ErrorCode.STORAGE_CONNECTION,
        cause: error as Error,
      });
    }
  }

  async disconnect(): Promise<void> {
    this._status = ConnectionStatus.DISCONNECTED;
    this.logger.info("OpenSearch 已断开");
  }

  isConnected(): boolean {
    return this._status === ConnectionStatus.CONNECTED;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await httpRequest(this.httpConfig, "/_cluster/health");
      return true;
    } catch {
      return false;
    }
  }

  async createIndex(index: string, mappings: IndexMapping): Promise<void> {
    this.ensureConnected();
    await httpRequest(this.httpConfig, `/${index}`, {
      method: "PUT",
      body: { mappings },
    });
    this.logger.info(`索引已创建: ${index}`);
  }

  async deleteIndex(index: string): Promise<void> {
    this.ensureConnected();
    await httpRequest(this.httpConfig, `/${index}`, { method: "DELETE" });
    this.logger.info(`索引已删除: ${index}`);
  }

  async indexExists(index: string): Promise<boolean> {
    this.ensureConnected();
    try {
      await httpRequest(this.httpConfig, `/${index}`);
      return true;
    } catch {
      return false;
    }
  }

  async listIndices(): Promise<string[]> {
    this.ensureConnected();
    const result = await httpRequest<Array<{ index: string }>>(
      this.httpConfig,
      "/_cat/indices",
      { params: { format: "json" } },
    );
    return result.map((i) => i.index).filter((n) => !n.startsWith("."));
  }

  async index(indexName: string, id: string, document: Record<string, unknown>): Promise<void> {
    this.ensureConnected();
    await httpRequest(this.httpConfig, `/${indexName}/_doc/${id}`, {
      method: "PUT",
      body: document,
    });
  }

  async bulkIndex(
    indexName: string,
    documents: Array<{ id: string; doc: Record<string, unknown> }>,
  ): Promise<BulkResult> {
    this.ensureConnected();
    const body = documents.flatMap((d) => [
      { index: { _index: indexName, _id: d.id } },
      d.doc,
    ]);

    const result = await httpRequest<{ errors: boolean; items: Array<{ index: { status: number; _id: string; error?: { reason: string } } }> }>(
      this.httpConfig,
      "/_bulk",
      { method: "POST", body },
    );

    const errors = result.items
      .filter((i) => i.index.error)
      .map((i) => ({ id: i.index._id, error: i.index.error!.reason }));

    return {
      succeeded: documents.length - errors.length,
      failed: errors.length,
      errors,
    };
  }

  async search(indexName: string, query: SearchQuery): Promise<SearchResult> {
    this.ensureConnected();
    const result = await httpRequest<{
      hits: {
        total: { value: number };
        hits: Array<{ _id: string; _score: number; _source: Record<string, unknown>; highlight?: Record<string, string[]> }>;
      };
      took: number;
    }>(this.httpConfig, `/${indexName}/_search`, {
      method: "POST",
      body: query,
    });

    return {
      hits: result.hits.hits.map((h) => ({
        id: h._id,
        score: h._score,
        source: h._source,
        highlight: h.highlight,
      })),
      total: result.hits.total.value,
      took: result.took,
    };
  }

  async deleteDocument(indexName: string, id: string): Promise<void> {
    this.ensureConnected();
    await httpRequest(this.httpConfig, `/${indexName}/_doc/${id}`, { method: "DELETE" });
  }

  private ensureConnected(): void {
    if (this._status !== ConnectionStatus.CONNECTED) {
      throw new StorageError("opensearch", "未连接", { code: ErrorCode.STORAGE_CONNECTION });
    }
  }
}
