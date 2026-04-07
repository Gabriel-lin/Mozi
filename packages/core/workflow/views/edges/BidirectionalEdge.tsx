import React, { useRef, useCallback, useState } from "react";
import { BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath } from "@xyflow/react";
import { ArrowShape, EdgePathType } from "../types";
import type { WorkflowEdgeProps } from "./types";
import { EdgeMarkerDefs, getMarkerId } from "./markers";
import { EdgeLabelRenderer } from "./EdgeLabel";

export function BidirectionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: WorkflowEdgeProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [, forceUpdate] = useState(0);

  const pathType = data?.pathType ?? EdgePathType.BEZIER;
  const color = data?.color ?? "#94a3b8";
  const strokeWidth = data?.strokeWidth ?? 2;
  const animated = data?.animated ?? false;
  const strokeDasharray = data?.strokeDasharray as string | undefined;

  const defaultArrow = { shape: ArrowShape.TRIANGLE_FILLED as const, color };
  const sourceArrow = data?.sourceArrow ?? defaultArrow;
  const targetArrow = data?.targetArrow ?? defaultArrow;

  let edgePath: string;

  switch (pathType) {
    case EdgePathType.STRAIGHT: {
      [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
      break;
    }
    case EdgePathType.SMOOTH_STEP: {
      [edgePath] = getSmoothStepPath({
        sourceX, sourceY, targetX, targetY,
        sourcePosition, targetPosition,
      });
      break;
    }
    case EdgePathType.BEZIER:
    default: {
      [edgePath] = getBezierPath({
        sourceX, sourceY, targetX, targetY,
        sourcePosition, targetPosition,
      });
      break;
    }
  }

  const refCallback = useCallback(
    (el: SVGPathElement | null) => {
      pathRef.current = el;
      forceUpdate((n) => n + 1);
    },
    [],
  );

  const startMarkerId = getMarkerId(id, "start");
  const endMarkerId = getMarkerId(id, "end");

  return (
    <g>
      <EdgeMarkerDefs edgeId={id} sourceArrow={sourceArrow} targetArrow={targetArrow} />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          ...(strokeDasharray ? { strokeDasharray } : {}),
          ...(animated ? { strokeDasharray: 5, animation: "wf-dash 0.5s linear infinite" } : {}),
          ...(selected ? { filter: "drop-shadow(0 0 3px rgba(99,102,241,0.5))", strokeWidth: strokeWidth + 0.5 } : {}),
          ...style,
          markerStart: `url(#${startMarkerId})`,
          markerEnd: `url(#${endMarkerId})`,
        }}
      />
      <path
        ref={refCallback}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "pointer" }}
      />
      {data?.label && (
        <EdgeLabelRenderer config={data.label} pathRef={pathRef.current} />
      )}
    </g>
  );
}
