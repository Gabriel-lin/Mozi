import { DriverType, type VectorCollectionConfig, type VectorRecord, type VectorSearchQuery, type VectorSearchResult } from "../../types";
import { BaseVectorDriver } from "./base";

export interface ChromaConfig {
  url: string;
  tenant?: string;
  database?: string;
  apiKey?: string;
}

export class ChromaDriver extends BaseVectorDriver {
  readonly driverType = DriverType.CHROMA;
  private tenant: string;
  private database: string;

  constructor(config: ChromaConfig) {
    super(
      {
        baseUrl: config.url,
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        timeout: 30000,
      },
      "chroma",
    );
    this.tenant = config.tenant ?? "default_tenant";
    this.database = config.database ?? "default_database";
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/api/v1/heartbeat");
      return true;
    } catch {
      return false;
    }
  }

  async createCollection(name: string, config: VectorCollectionConfig): Promise<void> {
    this.ensureConnected();
    const space = config.metric === "cosine" ? "cosine" : config.metric === "euclidean" ? "l2" : "ip";

    await this.request(`/api/v1/tenants/${this.tenant}/databases/${this.database}/collections`, {
      method: "POST",
      body: {
        name,
        metadata: { "hnsw:space": space, dimension: config.dimension },
      },
    });
    this.logger.info(`Chroma 集合已创建: ${name}`);
  }

  async deleteCollection(name: string): Promise<void> {
    this.ensureConnected();
    await this.request(
      `/api/v1/tenants/${this.tenant}/databases/${this.database}/collections/${name}`,
      { method: "DELETE" },
    );
    this.logger.info(`Chroma 集合已删除: ${name}`);
  }

  async collectionExists(name: string): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.request(
        `/api/v1/tenants/${this.tenant}/databases/${this.database}/collections/${name}`,
      );
      return true;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    this.ensureConnected();
    const result = await this.request<Array<{ name: string }>>(
      `/api/v1/tenants/${this.tenant}/databases/${this.database}/collections`,
    );
    return result.map((c) => c.name);
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    this.ensureConnected();
    const collId = await this.getCollectionId(collection);
    await this.request(`/api/v1/collections/${collId}/upsert`, {
      method: "POST",
      body: {
        ids: vectors.map((v) => v.id),
        embeddings: vectors.map((v) => v.values),
        metadatas: vectors.map((v) => v.metadata ?? {}),
      },
    });
  }

  async search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    this.ensureConnected();
    const collId = await this.getCollectionId(collection);

    const result = await this.request<{
      ids: string[][];
      distances: number[][];
      embeddings?: number[][][];
      metadatas?: Array<Array<Record<string, unknown>>>;
    }>(`/api/v1/collections/${collId}/query`, {
      method: "POST",
      body: {
        query_embeddings: [query.vector],
        n_results: query.topK,
        where: query.filter,
        include: [
          "distances",
          ...(query.includeMetadata ? ["metadatas"] : []),
          ...(query.includeValues ? ["embeddings"] : []),
        ],
      },
    });

    const ids = result.ids?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];
    const metadatas = result.metadatas?.[0];
    const embeddings = result.embeddings?.[0];

    return ids.map((id, i) => ({
      id,
      score: 1 - (distances[i] ?? 0),
      values: embeddings?.[i],
      metadata: metadatas?.[i],
    }));
  }

  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    this.ensureConnected();
    const collId = await this.getCollectionId(collection);
    await this.request(`/api/v1/collections/${collId}/delete`, {
      method: "POST",
      body: { ids },
    });
  }

  async getVector(collection: string, id: string): Promise<VectorRecord | null> {
    this.ensureConnected();
    const collId = await this.getCollectionId(collection);
    try {
      const result = await this.request<{
        ids: string[];
        embeddings: number[][];
        metadatas: Array<Record<string, unknown>>;
      }>(`/api/v1/collections/${collId}/get`, {
        method: "POST",
        body: { ids: [id], include: ["embeddings", "metadatas"] },
      });

      if (!result.ids?.length) return null;
      return {
        id: result.ids[0],
        values: result.embeddings[0],
        metadata: result.metadatas[0],
      };
    } catch {
      return null;
    }
  }

  private async getCollectionId(name: string): Promise<string> {
    const result = await this.request<{ id: string }>(
      `/api/v1/tenants/${this.tenant}/databases/${this.database}/collections/${name}`,
    );
    return result.id;
  }
}
