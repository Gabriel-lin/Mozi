import React, { useRef, useCallback, useState } from "react";
import { useInternalNode } from "@xyflow/react";
import { ArrowShape } from "../types";
import type { WorkflowEdgeProps } from "./types";
import { EdgeMarkerDefs, getMarkerId } from "./markers";
import { EdgeLabelRenderer } from "./EdgeLabel";
import { selfLoopPath } from "../utils";

const DEFAULT_LOOP_SIZE = 60;

export function SelfLoopEdge({
  id,
  source,
  data,
  selected,
  style,
}: WorkflowEdgeProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [, forceUpdate] = useState(0);

  const node = useInternalNode(source);

  const color = data?.color ?? "#94a3b8";
  const strokeWidth = data?.strokeWidth ?? 2;
  const animated = data?.animated ?? false;
  const strokeDasharray = data?.strokeDasharray as string | undefined;

  const targetArrow = data?.targetArrow ?? {
    shape: ArrowShape.TRIANGLE_FILLED,
    color,
  };

  if (!node) return null;

  const w = node.measured?.width ?? 180;
  const h = node.measured?.height ?? 60;
  const center = {
    x: node.internals.positionAbsolute.x + w / 2,
    y: node.internals.positionAbsolute.y + h / 2,
  };

  const d = selfLoopPath(center, w, h, DEFAULT_LOOP_SIZE);
  const markerId = getMarkerId(id, "end");

  const refCallback = useCallback(
    (el: SVGPathElement | null) => {
      pathRef.current = el;
      forceUpdate((n) => n + 1);
    },
    [],
  );

  return (
    <g>
      <EdgeMarkerDefs edgeId={id} targetArrow={targetArrow} sourceArrow={data?.sourceArrow} />
      <path
        id={id}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={`url(#${markerId})`}
        style={{
          ...(strokeDasharray ? { strokeDasharray } : {}),
          ...(animated ? { strokeDasharray: 5, animation: "wf-dash 0.5s linear infinite" } : {}),
          ...(selected ? { filter: "drop-shadow(0 0 3px rgba(99,102,241,0.5))", strokeWidth: strokeWidth + 0.5 } : {}),
          ...style,
        }}
      />
      <path
        ref={refCallback}
        d={d}
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
