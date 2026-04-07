import React from "react";
import {
  ArrowShape,
  type ArrowConfig,
} from "../types";
import {
  arrowTrianglePath,
  arrowDiamondPath,
  arrowCirclePath,
} from "../utils";

const DEFAULT_SIZE = 8;
const DEFAULT_COLOR = "#64748b";

export function getMarkerId(edgeId: string, end: "start" | "end"): string {
  return `wf-arrow-${edgeId}-${end}`;
}

function buildMarkerDef(
  id: string,
  config: ArrowConfig,
  filled: boolean,
): React.ReactElement | null {
  const shape = config.shape ?? ArrowShape.TRIANGLE_FILLED;
  if (shape === ArrowShape.NONE) return null;

  const size = config.size ?? DEFAULT_SIZE;
  const color = config.color ?? DEFAULT_COLOR;

  let path: string;
  let isFilled: boolean;

  switch (shape) {
    case ArrowShape.TRIANGLE:
      path = arrowTrianglePath(size);
      isFilled = false;
      break;
    case ArrowShape.TRIANGLE_FILLED:
      path = arrowTrianglePath(size);
      isFilled = true;
      break;
    case ArrowShape.DIAMOND:
      path = arrowDiamondPath(size);
      isFilled = filled;
      break;
    case ArrowShape.CIRCLE:
      path = arrowCirclePath(size);
      isFilled = filled;
      break;
    default:
      return null;
  }

  return (
    <marker
      id={id}
      viewBox={`0 0 ${size} ${size}`}
      refX={size}
      refY={size / 2}
      markerWidth={size}
      markerHeight={size}
      markerUnits="userSpaceOnUse"
      orient="auto-start-reverse"
    >
      <path
        d={path}
        fill={isFilled ? color : "none"}
        stroke={color}
        strokeWidth={1.5}
      />
    </marker>
  );
}

export function EdgeMarkerDefs({
  edgeId,
  sourceArrow,
  targetArrow,
}: {
  edgeId: string;
  sourceArrow?: ArrowConfig;
  targetArrow?: ArrowConfig;
}): React.ReactElement | null {
  const startMarker = sourceArrow
    ? buildMarkerDef(getMarkerId(edgeId, "start"), sourceArrow, true)
    : null;

  const endMarker = targetArrow
    ? buildMarkerDef(getMarkerId(edgeId, "end"), targetArrow, true)
    : null;

  if (!startMarker && !endMarker) return null;

  return (
    <defs>
      {startMarker}
      {endMarker}
    </defs>
  );
}
