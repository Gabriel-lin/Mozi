import type { Node, Edge } from "@xyflow/react";
import { z } from "zod/v4";

/** A single snapshot in the undo/redo history stack. */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  label?: string;
}

export const historyEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  nodes: z.array(z.record(z.string(), z.unknown())).transform((v) => v as unknown as Node[]),
  edges: z.array(z.record(z.string(), z.unknown())).transform((v) => v as unknown as Edge[]),
  label: z.string().optional(),
});

/** Aggregate state of the history stack. */
export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
}
