import { DriverType, type VectorCollectionConfig, type VectorRecord, type VectorSearchQuery, type VectorSearchResult } from "../../types";
import { BaseVectorDriver } from "./base";

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}

export class QdrantDriver extends BaseVectorDriver {
  readonly driverType = DriverType.QDRANT;

  constructor(config: QdrantConfig) {
    super(
      {
        baseUrl: config.url,
        headers: config.apiKey ? { "api-key": config.apiKey } : {},
        timeout: config.timeout ?? 30000,
      },
      "qdrant",
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/healthz");
      return true;
    } catch {
      return false;
    }
  }

  async createCollection(name: string, config: VectorCollectionConfig): Promise<void> {
    this.ensureConnected();
    const distance = config.metric === "cosine" ? "Cosine" : config.metric === "euclidean" ? "Euclid" : "Dot";

    await this.request(`/collections/${name}`, {
      method: "PUT",
      body: {
        vectors: { size: config.dimension, distance },
      },
    });
    this.logger.info(`Qdrant 集合已创建: ${name}`);
  }

  async deleteCollection(name: string): Promise<void> {
    this.ensureConnected();
    await this.request(`/collections/${name}`, { method: "DELETE" });
    this.logger.info(`Qdrant 集合已删除: ${name}`);
  }

  async collectionExists(name: string): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.request(`/collections/${name}`);
      return true;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    this.ensureConnected();
    const result = await this.request<{
      result: { collections: Array<{ name: string }> };
    }>("/collections");
    return (result.result?.collections ?? []).map((c) => c.name);
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    this.ensureConnected();
    await this.request(`/collections/${collection}/points`, {
      method: "PUT",
      body: {
        points: vectors.map((v) => ({
          id: v.id,
          vector: v.values,
          payload: v.metadata ?? {},
        })),
      },
    });
  }

  async search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    this.ensureConnected();
    const result = await this.request<{
      result: Array<{ id: string; score: number; vector?: number[]; payload?: Record<string, unknown> }>;
    }>(`/collections/${collection}/points/search`, {
      method: "POST",
      body: {
        vector: query.vector,
        limit: query.topK,
        filter: query.filter ? { must: Object.entries(query.filter).map(([k, v]) => ({ key: k, match: { value: v } })) } : undefined,
        with_payload: query.includeMetadata ?? true,
        with_vector: query.includeValues ?? false,
      },
    });

    return (result.result ?? []).map((r) => ({
      id: String(r.id),
      score: r.score,
      values: r.vector,
      metadata: r.payload,
    }));
  }

  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    this.ensureConnected();
    await this.request(`/collections/${collection}/points/delete`, {
      method: "POST",
      body: { points: ids },
    });
  }

  async getVector(collection: string, id: string): Promise<VectorRecord | null> {
    this.ensureConnected();
    try {
      const result = await this.request<{
        result: { id: string; vector: number[]; payload?: Record<string, unknown> };
      }>(`/collections/${collection}/points/${id}`);

      const r = result.result;
      if (!r) return null;
      return { id: String(r.id), values: r.vector, metadata: r.payload };
    } catch {
      return null;
    }
  }
}
