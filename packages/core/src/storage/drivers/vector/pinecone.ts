import { DriverType, type VectorCollectionConfig, type VectorRecord, type VectorSearchQuery, type VectorSearchResult } from "../../types";
import { BaseVectorDriver } from "./base";

export interface PineconeConfig {
  apiKey: string;
  environment: string;
  projectId?: string;
}

export class PineconeDriver extends BaseVectorDriver {
  readonly driverType = DriverType.PINECONE;

  constructor(config: PineconeConfig) {
    super(
      {
        baseUrl: `https://controller.${config.environment}.pinecone.io`,
        headers: { "Api-Key": config.apiKey },
        timeout: 30000,
      },
      "pinecone",
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/actions/whoami");
      return true;
    } catch {
      return false;
    }
  }

  async createCollection(name: string, config: VectorCollectionConfig): Promise<void> {
    this.ensureConnected();
    await this.request("/databases", {
      method: "POST",
      body: {
        name,
        dimension: config.dimension,
        metric: config.metric === "dotProduct" ? "dotproduct" : config.metric,
      },
    });
    this.logger.info(`Pinecone 索引已创建: ${name}`);
  }

  async deleteCollection(name: string): Promise<void> {
    this.ensureConnected();
    await this.request(`/databases/${name}`, { method: "DELETE" });
    this.logger.info(`Pinecone 索引已删除: ${name}`);
  }

  async collectionExists(name: string): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.request(`/databases/${name}`);
      return true;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    this.ensureConnected();
    const result = await this.request<string[]>("/databases");
    return result;
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    this.ensureConnected();
    await this.request(`/vectors/upsert`, {
      method: "POST",
      body: {
        vectors: vectors.map((v) => ({
          id: v.id,
          values: v.values,
          metadata: v.metadata,
        })),
        namespace: collection,
      },
    });
  }

  async search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    this.ensureConnected();
    const result = await this.request<{
      matches: Array<{ id: string; score: number; values?: number[]; metadata?: Record<string, unknown> }>;
    }>("/query", {
      method: "POST",
      body: {
        vector: query.vector,
        topK: query.topK,
        namespace: collection,
        filter: query.filter,
        includeMetadata: query.includeMetadata ?? true,
        includeValues: query.includeValues ?? false,
      },
    });

    return (result.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score,
      values: m.values,
      metadata: m.metadata,
    }));
  }

  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    this.ensureConnected();
    await this.request("/vectors/delete", {
      method: "POST",
      body: { ids, namespace: collection },
    });
  }

  async getVector(collection: string, id: string): Promise<VectorRecord | null> {
    this.ensureConnected();
    try {
      const result = await this.request<{
        vectors: Record<string, { id: string; values: number[]; metadata?: Record<string, unknown> }>;
      }>("/vectors/fetch", {
        method: "POST",
        body: { ids: [id], namespace: collection },
      });

      const vec = result.vectors?.[id];
      if (!vec) return null;
      return { id: vec.id, values: vec.values, metadata: vec.metadata };
    } catch {
      return null;
    }
  }
}
