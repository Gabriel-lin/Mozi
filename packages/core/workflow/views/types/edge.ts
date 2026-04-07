import type { Edge } from "@xyflow/react";
import { z } from "zod/v4";

/** Direction type of an edge. */
export enum ViewEdgeType {
  DIRECTIONAL = "directional",
  BIDIRECTIONAL = "bidirectional",
  SELF_LOOP = "selfLoop",
}

export const viewEdgeTypeSchema = z.enum(["directional", "bidirectional", "selfLoop"]);

/** Path interpolation method for edges. */
export enum EdgePathType {
  BEZIER = "bezier",
  STRAIGHT = "straight",
  STEP = "step",
  SMOOTH_STEP = "smoothstep",
}

export const edgePathTypeSchema = z.enum(["bezier", "straight", "step", "smoothstep"]);

/** Visual shape of an arrow marker. */
export enum ArrowShape {
  TRIANGLE = "triangle",
  TRIANGLE_FILLED = "triangleFilled",
  DIAMOND = "diamond",
  CIRCLE = "circle",
  NONE = "none",
}

export const arrowShapeSchema = z.enum([
  "triangle",
  "triangleFilled",
  "diamond",
  "circle",
  "none",
]);

/** Arrow marker configuration. */
export interface ArrowConfig {
  shape?: ArrowShape;
  color?: string;
  size?: number;
}

export const arrowConfigSchema = z.object({
  shape: arrowShapeSchema.optional(),
  color: z.string().optional(),
  size: z.number().optional(),
});

/** Label configuration for an edge. */
export interface EdgeLabelConfig {
  text: string;
  color?: string;
  fontSize?: number;
  /** 0–1 ratio along the edge path where the label is placed. */
  position?: number;
  bgColor?: string;
  bgPadding?: [number, number];
}

export const edgeLabelConfigSchema = z.object({
  text: z.string(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  position: z.number().min(0).max(1).optional(),
  bgColor: z.string().optional(),
  bgPadding: z.tuple([z.number(), z.number()]).optional(),
});

/** Full data payload carried by a workflow edge. */
export type WorkflowViewEdgeData = {
  edgeType?: ViewEdgeType;
  pathType?: EdgePathType;
  sourceArrow?: ArrowConfig;
  targetArrow?: ArrowConfig;
  label?: EdgeLabelConfig;
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
  className?: string;
  [key: string]: unknown;
};

export const workflowViewEdgeDataSchema = z.object({
  edgeType: viewEdgeTypeSchema.optional(),
  pathType: edgePathTypeSchema.optional(),
  sourceArrow: arrowConfigSchema.optional(),
  targetArrow: arrowConfigSchema.optional(),
  label: edgeLabelConfigSchema.optional(),
  color: z.string().optional(),
  strokeWidth: z.number().optional(),
  animated: z.boolean().optional(),
  className: z.string().optional(),
});

/** Typed ReactFlow edge alias. */
export type WorkflowViewEdge = Edge<WorkflowViewEdgeData>;
