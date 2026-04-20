import type { CSSProperties } from "react";
import type { Node } from "@xyflow/react";

/** CSS keys removed before applying collapsed-group row layout or when merging expand restore. */
const WORKFLOW_NODE_SIZING_KEYS = new Set([
  "minHeight",
  "maxHeight",
  "minWidth",
  "maxWidth",
  "height",
  "width",
  "flex",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "aspectRatio",
  "overflow",
]);

/**
 * Parse numeric size from React inline style (`number`, `"px"` string, etc.).
 */
export function parseCssSize(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Drop sizing / flex / overflow entries so they do not fight fixed-height collapsed group rows
 * or leak into restored styles after expand.
 */
export function stripWorkflowNodeSizingStyle(style: CSSProperties | undefined): CSSProperties {
  if (!style) return {};
  return Object.fromEntries(
    Object.entries(style).filter(([k]) => !WORKFLOW_NODE_SIZING_KEYS.has(k)),
  ) as CSSProperties;
}

/**
 * Restore pre-collapse `style` while clearing collapse-time props on `current` that may be
 * absent from `snapshot` (e.g. `maxHeight` on rows).
 */
export function mergeWorkflowNodeStyleForGroupExpand(
  current: CSSProperties | undefined,
  snapshot: CSSProperties | undefined,
): CSSProperties {
  return {
    ...stripWorkflowNodeSizingStyle(current),
    ...(snapshot && Object.keys(snapshot).length > 0 ? snapshot : {}),
  };
}

function firstPositiveSize(...candidates: (number | undefined)[]): number | undefined {
  for (const v of candidates) {
    if (typeof v === "number" && v > 0) return v;
  }
  return undefined;
}

/** Pixel bounds RF uses (`measured` → `width`/`height` → `style`, same order as `getNodeDimensions`). */
export function readWorkflowRfNodePixelBounds(
  node: Node,
  fallbackW: number,
  fallbackH: number,
): { w: number; h: number } {
  const style = (node.style ?? {}) as Record<string, unknown>;
  const w = firstPositiveSize(node.measured?.width, node.width, parseCssSize(style.width)) ?? fallbackW;
  const h = firstPositiveSize(node.measured?.height, node.height, parseCssSize(style.height)) ?? fallbackH;
  return { w: Math.round(w), h: Math.round(h) };
}

/** Align `width` / `height` / `measured`; strip `style` w/h (RF inline size comes from top-level fields). */
export function patchWorkflowRfNodePixelBounds(node: Node, width: number, height: number): Partial<Node> {
  const prev = { ...(node.style ?? {}) } as Record<string, unknown>;
  delete prev.width;
  delete prev.height;
  return {
    width,
    height,
    measured: { width, height },
    style: prev as Node["style"],
  };
}
