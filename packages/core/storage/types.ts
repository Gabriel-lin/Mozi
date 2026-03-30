export enum DriverType {
  POSTGRESQL = "postgresql",
  SQLITE = "sqlite",
  OPENSEARCH = "opensearch",
  PINECONE = "pinecone",
  MILVUS = "milvus",
  QDRANT = "qdrant",
  CHROMA = "chroma",
}

export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

export interface StorageDriver {
  readonly driverType: DriverType;
  readonly status: ConnectionStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;
}

export interface RelationalDriver extends StorageDriver {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  tableExists(table: string): Promise<boolean>;
  listTables(): Promise<string[]>;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields: string[];
}

export interface ExecuteResult {
  affectedRows: number;
  lastInsertId?: string | number;
}

export interface TransactionContext {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
}

export interface SearchDriver extends StorageDriver {
  createIndex(index: string, mappings: IndexMapping): Promise<void>;
  deleteIndex(index: string): Promise<void>;
  indexExists(index: string): Promise<boolean>;
  listIndices(): Promise<string[]>;
  index(indexName: string, id: string, document: Record<string, unknown>): Promise<void>;
  bulkIndex(indexName: string, documents: Array<{ id: string; doc: Record<string, unknown> }>): Promise<BulkResult>;
  search(indexName: string, query: SearchQuery): Promise<SearchResult>;
  deleteDocument(indexName: string, id: string): Promise<void>;
}

export interface IndexMapping {
  properties: Record<string, { type: string; analyzer?: string; [key: string]: unknown }>;
}

export interface SearchQuery {
  query?: Record<string, unknown>;
  size?: number;
  from?: number;
  sort?: Array<Record<string, "asc" | "desc">>;
  highlight?: { fields: Record<string, unknown> };
}

export interface SearchResult {
  hits: Array<{
    id: string;
    score: number;
    source: Record<string, unknown>;
    highlight?: Record<string, string[]>;
  }>;
  total: number;
  took: number;
}

export interface BulkResult {
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface VectorDriver extends StorageDriver {
  createCollection(name: string, config: VectorCollectionConfig): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
  upsert(collection: string, vectors: VectorRecord[]): Promise<void>;
  search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  deleteVectors(collection: string, ids: string[]): Promise<void>;
  getVector(collection: string, id: string): Promise<VectorRecord | null>;
}

export interface VectorCollectionConfig {
  dimension: number;
  metric: "cosine" | "euclidean" | "dotProduct";
  metadata?: Record<string, "string" | "number" | "boolean">;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchQuery {
  vector: number[];
  topK: number;
  filter?: Record<string, unknown>;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, unknown>;
}

export interface HttpRequestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}
