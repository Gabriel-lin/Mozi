import type { ReactNode } from "react";
import type { Node } from "@xyflow/react";
import { z } from "zod/v4";
import { type HandleConfig, type ViewNodeShape, viewNodeShapeSchema, handleConfigSchema } from "./common";

/** Data payload for the general-purpose workflow node. */
export type WorkflowViewNodeData = {
  label: string;
  /** When true, only the header bar is shown (thumbnail mode). */
  collapsed?: boolean;
  shape?: ViewNodeShape;
  inputs: HandleConfig[];
  outputs: HandleConfig[];
  content?: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  className?: string;
  [key: string]: unknown;
};

export const workflowViewNodeDataSchema = z.object({
  label: z.string(),
  collapsed: z.boolean().optional(),
  shape: viewNodeShapeSchema.optional(),
  inputs: z.array(handleConfigSchema).min(1),
  outputs: z.array(handleConfigSchema).min(1),
  headerClassName: z.string().optional(),
  contentClassName: z.string().optional(),
  footerClassName: z.string().optional(),
  className: z.string().optional(),
});

/** Data payload for pure-text nodes. */
export type TextNodeData = {
  text: string;
  collapsed?: boolean;
  shape?: ViewNodeShape;
  inputs: HandleConfig[];
  outputs: HandleConfig[];
  fontSize?: number;
  color?: string;
  className?: string;
  [key: string]: unknown;
};

export const textNodeDataSchema = z.object({
  text: z.string(),
  collapsed: z.boolean().optional(),
  shape: viewNodeShapeSchema.optional(),
  inputs: z.array(handleConfigSchema).min(1),
  outputs: z.array(handleConfigSchema).min(1),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  className: z.string().optional(),
});

/** Typed ReactFlow node aliases. */
export type WorkflowViewNode = Node<WorkflowViewNodeData, "workflowBase">;
export type TextViewNode = Node<TextNodeData, "workflowText">;
export type AnyViewNode = WorkflowViewNode | TextViewNode;
