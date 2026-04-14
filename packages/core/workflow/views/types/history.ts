import type { Node, Edge } from "@xyflow/react";
import { z } from "zod/v4";

/** Optional metadata describing what produced this snapshot (for tooling / UX). */
export interface HistoryOperation {
  kind: string;
  payload?: unknown;
}

export interface HistoryEntryMeta {
  label?: string;
  operation?: HistoryOperation;
}

/** A single snapshot in the undo/redo history stack. */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  label?: string;
  /** What user action created this snapshot (full graph is still authoritative). */
  operation?: HistoryOperation;
}

export const historyEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  nodes: z.array(z.record(z.string(), z.unknown())).transform((v) => v as unknown as Node[]),
  edges: z.array(z.record(z.string(), z.unknown())).transform((v) => v as unknown as Edge[]),
  label: z.string().optional(),
  operation: z
    .object({
      kind: z.string(),
      payload: z.unknown().optional(),
    })
    .optional(),
});

/** Aggregate state of the history stack. */
export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
}
