import type { ReactNode } from "react";
import { z } from "zod/v4";

/** A view-level plugin that renders into one of the four corner slots. */
export interface ViewPlugin {
  id: string;
  name: string;
  enabled?: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  render: () => ReactNode;
  onInit?: () => void;
  onDestroy?: () => void;
}

export const viewPluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().optional(),
  position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
});
