import { z } from "zod/v4";

/** Controls spacing density when auto-laying-out nodes. */
export enum LayoutDensity {
  COMPACT = "compact",
  SPARSE = "sparse",
}

export const layoutDensitySchema = z.enum(["compact", "sparse"]);

/** Options accepted by {@link computeLayout}. */
export interface LayoutOptions {
  density: LayoutDensity;
  direction?: "TB" | "LR" | "BT" | "RL";
  nodeSpacingX?: number;
  nodeSpacingY?: number;
}

export const layoutOptionsSchema = z.object({
  density: layoutDensitySchema,
  direction: z.enum(["TB", "LR", "BT", "RL"]).optional(),
  nodeSpacingX: z.number().optional(),
  nodeSpacingY: z.number().optional(),
});
