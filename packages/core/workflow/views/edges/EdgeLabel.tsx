import React from "react";
import type { EdgeLabelConfig } from "../types";

interface Props {
  config: EdgeLabelConfig;
  pathRef: SVGPathElement | null;
}

export function EdgeLabelRenderer({ config, pathRef }: Props) {
  if (!pathRef) return null;

  const t = config.position ?? 0.5;
  const totalLen = pathRef.getTotalLength();
  const point = pathRef.getPointAtLength(totalLen * t);

  const [padX, padY] = config.bgPadding ?? [6, 3];

  return (
    <g transform={`translate(${point.x}, ${point.y})`}>
      {config.bgColor && (
        <rect
          x={-padX}
          y={-10 - padY}
          rx={4}
          ry={4}
          fill={config.bgColor}
        />
      )}
      <text
        textAnchor="middle"
        dy="-4"
        fontSize={config.fontSize ?? 11}
        fill={config.color ?? "#64748b"}
        fontFamily="inherit"
        className="pointer-events-none select-none"
      >
        {config.text}
      </text>
    </g>
  );
}
