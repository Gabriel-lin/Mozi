import { DriverType, type VectorCollectionConfig, type VectorRecord, type VectorSearchQuery, type VectorSearchResult } from "../../types";
import { BaseVectorDriver } from "./base";

export interface MilvusConfig {
  address: string;
  port?: number;
  token?: string;
  database?: string;
}

export class MilvusDriver extends BaseVectorDriver {
  readonly driverType = DriverType.MILVUS;
  private database: string;

  constructor(config: MilvusConfig) {
    const baseUrl = `http://${config.address}:${config.port ?? 19530}`;
    super(
      {
        baseUrl,
        headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
        timeout: 30000,
      },
      "milvus",
    );
    this.database = config.database ?? "default";
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/v2/vectordb/collections/list", {
        method: "POST",
        body: { dbName: this.database },
      });
      return true;
    } catch {
      return false;
    }
  }

  async createCollection(name: string, config: VectorCollectionConfig): Promise<void> {
    this.ensureConnected();
    const metricType = config.metric === "cosine" ? "COSINE" : config.metric === "euclidean" ? "L2" : "IP";

    await this.request("/v2/vectordb/collections/create", {
      method: "POST",
      body: {
        dbName: this.database,
        collectionName: name,
        dimension: config.dimension,
        metricType,
      },
    });
    this.logger.info(`Milvus 集合已创建: ${name}`);
  }

  async deleteCollection(name: string): Promise<void> {
    this.ensureConnected();
    await this.request("/v2/vectordb/collections/drop", {
      method: "POST",
      body: { dbName: this.database, collectionName: name },
    });
    this.logger.info(`Milvus 集合已删除: ${name}`);
  }

  async collectionExists(name: string): Promise<boolean> {
    this.ensureConnected();
    try {
      const result = await this.request<{ data: { exists: boolean } }>(
        "/v2/vectordb/collections/has",
        { method: "POST", body: { dbName: this.database, collectionName: name } },
      );
      return result.data?.exists ?? false;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    this.ensureConnected();
    const result = await this.request<{ data: string[] }>(
      "/v2/vectordb/collections/list",
      { method: "POST", body: { dbName: this.database } },
    );
    return result.data ?? [];
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    this.ensureConnected();
    await this.request("/v2/vectordb/entities/upsert", {
      method: "POST",
      body: {
        dbName: this.database,
        collectionName: collection,
        data: vectors.map((v) => ({
          id: v.id,
          vector: v.values,
          ...v.metadata,
        })),
      },
    });
  }

  async search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    this.ensureConnected();
    const result = await this.request<{
      data: Array<{ id: string; distance: number; [key: string]: unknown }>;
    }>("/v2/vectordb/entities/search", {
      method: "POST",
      body: {
        dbName: this.database,
        collectionName: collection,
        data: [query.vector],
        limit: query.topK,
        filter: query.filter ? JSON.stringify(query.filter) : undefined,
        outputFields: ["*"],
      },
    });

    return (result.data ?? []).map((item) => {
      const { id, distance, ...metadata } = item;
      return { id: String(id), score: distance, metadata };
    });
  }

  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    this.ensureConnected();
    await this.request("/v2/vectordb/entities/delete", {
      method: "POST",
      body: {
        dbName: this.database,
        collectionName: collection,
        filter: `id in [${ids.map((id) => `"${id}"`).join(",")}]`,
      },
    });
  }

  async getVector(collection: string, id: string): Promise<VectorRecord | null> {
    this.ensureConnected();
    try {
      const result = await this.request<{ data: Array<{ id: string; vector: number[]; [key: string]: unknown }> }>(
        "/v2/vectordb/entities/get",
        {
          method: "POST",
          body: {
            dbName: this.database,
            collectionName: collection,
            id: [id],
            outputFields: ["*"],
          },
        },
      );
      const item = result.data?.[0];
      if (!item) return null;
      const { id: vecId, vector, ...metadata } = item;
      return { id: String(vecId), values: vector, metadata };
    } catch {
      return null;
    }
  }
}
