import { z } from "zod/v4";

/** Visual shape of a workflow node. */
export enum ViewNodeShape {
  SQUARE = "square",
  CIRCLE = "circle",
}

export const viewNodeShapeSchema = z.enum(["square", "circle"]);

/** Configuration for a single input/output handle on a node. */
export interface HandleConfig {
  id: string;
  label?: string;
  position?: "left" | "right" | "top" | "bottom";
}

export const handleConfigSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  position: z.enum(["left", "right", "top", "bottom"]).optional(),
});
