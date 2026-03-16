export interface DataSchema {
  fields: FieldDef[];
  primaryKey?: string;
}

export interface FieldDef {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "json" | "array";
  required?: boolean;
  defaultValue?: unknown;
  validator?: (value: unknown) => boolean;
}

export interface DataRecord {
  [key: string]: unknown;
}

export interface DataSource<T extends DataRecord = DataRecord> {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(query?: DataQuery): Promise<T[]>;
  write(records: T[]): Promise<number>;
  count(query?: DataQuery): Promise<number>;
}

export interface DataQuery {
  filter?: Record<string, unknown>;
  sort?: Array<{ field: string; order: "asc" | "desc" }>;
  limit?: number;
  offset?: number;
  fields?: string[];
}

export type TransformFn<In = DataRecord, Out = DataRecord> = (records: In[]) => Out[] | Promise<Out[]>;

export interface PipelineStage<In = DataRecord, Out = DataRecord> {
  name: string;
  transform: TransformFn<In, Out>;
}

export interface DataFactoryConfig {
  name: string;
  schema?: DataSchema;
  source?: DataSource;
}
