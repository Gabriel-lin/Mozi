import type { XYPosition } from "@xyflow/react";

/** Euclidean distance between two points. */
export function distance(a: XYPosition, b: XYPosition): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Midpoint of two positions. */
export function midpoint(a: XYPosition, b: XYPosition): XYPosition {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Clamp `value` into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute a quadratic Bézier control-point that sits perpendicular to
 * the source→target segment, offset by `curvature` pixels.
 */
export function quadraticControlPoint(
  source: XYPosition,
  target: XYPosition,
  curvature = 50,
): XYPosition {
  const mid = midpoint(source, target);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: mid.x + (-dy / len) * curvature,
    y: mid.y + (dx / len) * curvature,
  };
}

/**
 * Generate a cubic-Bézier SVG path string for a self-loop that exits the
 * node from its right side and re-enters from the top.
 */
export function selfLoopPath(
  nodeCenter: XYPosition,
  nodeWidth: number,
  nodeHeight: number,
  loopSize = 60,
): string {
  const topY = nodeCenter.y - nodeHeight / 2;
  const rightX = nodeCenter.x + nodeWidth / 2;
  const startX = rightX;
  const startY = nodeCenter.y;
  const endX = nodeCenter.x;
  const endY = topY;
  const cx1 = startX + loopSize;
  const cy1 = startY - loopSize;
  const cx2 = endX + loopSize;
  const cy2 = endY - loopSize;

  return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;
}
