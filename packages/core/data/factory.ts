import { DataError, ErrorCode } from "../errors";
import type { DataRecord, DataSource, DataSchema, FieldDef } from "./types";

export class MemoryDataSource<T extends DataRecord = DataRecord> implements DataSource<T> {
  readonly name: string;
  private records: T[] = [];
  private schema?: DataSchema;

  constructor(name: string, schema?: DataSchema, initialData?: T[]) {
    this.name = name;
    this.schema = schema;
    if (initialData) this.records = [...initialData];
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async read(query?: import("./types").DataQuery): Promise<T[]> {
    let result = [...this.records];

    if (query?.filter) {
      result = result.filter((r) =>
        Object.entries(query.filter!).every(([k, v]) => r[k] === v),
      );
    }

    if (query?.sort) {
      for (const s of [...query.sort].reverse()) {
        result.sort((a, b) => {
          const va = a[s.field] as string | number;
          const vb = b[s.field] as string | number;
          if (va === vb) return 0;
          return (va < vb ? -1 : 1) * (s.order === "asc" ? 1 : -1);
        });
      }
    }

    if (query?.offset) result = result.slice(query.offset);
    if (query?.limit) result = result.slice(0, query.limit);

    if (query?.fields) {
      result = result.map((r) => {
        const picked: DataRecord = {};
        for (const f of query.fields!) {
          if (f in r) picked[f] = r[f];
        }
        return picked as T;
      });
    }

    return result;
  }

  async write(records: T[]): Promise<number> {
    if (this.schema) {
      for (const record of records) {
        this.validate(record);
      }
    }
    this.records.push(...records);
    return records.length;
  }

  async count(query?: import("./types").DataQuery): Promise<number> {
    if (!query?.filter) return this.records.length;
    return (await this.read(query)).length;
  }

  private validate(record: DataRecord): void {
    if (!this.schema) return;
    for (const field of this.schema.fields) {
      if (field.required && !(field.name in record)) {
        throw new DataError(`缺少必填字段: ${field.name}`, { code: ErrorCode.DATA_SCHEMA });
      }
      if (field.name in record && field.validator && !field.validator(record[field.name])) {
        throw new DataError(`字段验证失败: ${field.name}`, { code: ErrorCode.DATA_SCHEMA });
      }
    }
  }
}

export class DataSourceRegistry {
  private sources = new Map<string, DataSource>();

  register(source: DataSource): void {
    this.sources.set(source.name, source);
  }

  get<T extends DataRecord = DataRecord>(name: string): DataSource<T> | undefined {
    return this.sources.get(name) as DataSource<T> | undefined;
  }

  unregister(name: string): boolean {
    return this.sources.delete(name);
  }

  listAll(): Array<{ name: string }> {
    return Array.from(this.sources.keys()).map((name) => ({ name }));
  }

  async disconnectAll(): Promise<void> {
    for (const source of this.sources.values()) {
      await source.disconnect();
    }
  }
}

export function defineSchema(fields: FieldDef[], primaryKey?: string): DataSchema {
  return { fields, primaryKey };
}
