import type { DataRecord, TransformFn } from "./types";

export function mapFields<T extends DataRecord>(
  mapping: Record<string, string>,
): TransformFn<T, DataRecord> {
  return (records) =>
    records.map((r) => {
      const result: DataRecord = {};
      for (const [from, to] of Object.entries(mapping)) {
        if (from in r) result[to] = r[from];
      }
      return result;
    });
}

export function filterRecords<T extends DataRecord>(
  predicate: (record: T) => boolean,
): TransformFn<T, T> {
  return (records) => records.filter(predicate);
}

export function sortRecords<T extends DataRecord>(
  field: keyof T & string,
  order: "asc" | "desc" = "asc",
): TransformFn<T, T> {
  return (records) =>
    [...records].sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va === vb) return 0;
      const cmp = va != null && vb != null && va < vb ? -1 : 1;
      return order === "asc" ? cmp : -cmp;
    });
}

export function limitRecords<T extends DataRecord>(limit: number, offset = 0): TransformFn<T, T> {
  return (records) => records.slice(offset, offset + limit);
}

export function pickFields<T extends DataRecord>(fields: string[]): TransformFn<T, DataRecord> {
  return (records) =>
    records.map((r) => {
      const result: DataRecord = {};
      for (const f of fields) {
        if (f in r) result[f] = r[f];
      }
      return result;
    });
}

export function omitFields<T extends DataRecord>(fields: string[]): TransformFn<T, DataRecord> {
  const fieldSet = new Set(fields);
  return (records) =>
    records.map((r) => {
      const result: DataRecord = {};
      for (const [k, v] of Object.entries(r)) {
        if (!fieldSet.has(k)) result[k] = v;
      }
      return result;
    });
}

export function computeField<T extends DataRecord>(
  fieldName: string,
  compute: (record: T) => unknown,
): TransformFn<T, T & DataRecord> {
  return (records) =>
    records.map((r) => ({
      ...r,
      [fieldName]: compute(r),
    }));
}

export function groupBy<T extends DataRecord>(
  field: keyof T & string,
): TransformFn<T, DataRecord> {
  return (records) => {
    const groups = new Map<unknown, T[]>();
    for (const r of records) {
      const key = r[field];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      count: items.length,
      items,
    }));
  };
}

export function aggregate<T extends DataRecord>(config: {
  groupField?: string;
  measures: Array<{
    field: string;
    fn: "sum" | "avg" | "min" | "max" | "count";
    alias: string;
  }>;
}): TransformFn<T, DataRecord> {
  return (records) => {
    const compute = (items: T[]) => {
      const result: DataRecord = {};
      for (const m of config.measures) {
        const values = items.map((r) => Number(r[m.field])).filter((v) => !isNaN(v));
        switch (m.fn) {
          case "sum":
            result[m.alias] = values.reduce((a, b) => a + b, 0);
            break;
          case "avg":
            result[m.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case "min":
            result[m.alias] = values.length > 0 ? Math.min(...values) : null;
            break;
          case "max":
            result[m.alias] = values.length > 0 ? Math.max(...values) : null;
            break;
          case "count":
            result[m.alias] = items.length;
            break;
        }
      }
      return result;
    };

    if (!config.groupField) return [compute(records)];

    const groups = new Map<unknown, T[]>();
    for (const r of records) {
      const key = r[config.groupField];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      [config.groupField!]: key,
      ...compute(items),
    }));
  };
}
