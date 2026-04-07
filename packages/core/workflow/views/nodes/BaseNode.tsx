import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ViewNodeShape, type HandleConfig } from "../types";
import type { BaseNodeProps } from "./types";

const SHAPE_STYLES: Record<ViewNodeShape, React.CSSProperties> = {
  [ViewNodeShape.SQUARE]: {
    borderRadius: 8,
  },
  [ViewNodeShape.CIRCLE]: {
    borderRadius: "50%",
    aspectRatio: "1 / 1",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
};

const positionMap: Record<string, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function resolvePosition(pos: string | undefined, fallback: Position): Position {
  return pos ? positionMap[pos] ?? fallback : fallback;
}

function renderHandles(
  handles: HandleConfig[],
  type: "source" | "target",
  defaultPosition: Position,
) {
  const count = handles.length;
  return handles.map((h, i) => {
    const pos = resolvePosition(h.position, defaultPosition);
    const isVertical = pos === Position.Top || pos === Position.Bottom;
    const offset = count > 1 ? ((i + 1) / (count + 1)) * 100 : 50;

    const style: React.CSSProperties = isVertical
      ? { left: `${offset}%` }
      : { top: `${offset}%` };

    return (
      <Handle
        key={h.id}
        id={h.id}
        type={type}
        position={pos}
        style={{
          width: 10,
          height: 10,
          background: type === "target" ? "#6366f1" : "#22c55e",
          border: "2px solid #fff",
          ...style,
        }}
        title={h.label}
      />
    );
  });
}

export const BaseNode = memo(function BaseNode({ data, selected }: BaseNodeProps) {
  const shape = data.shape ?? ViewNodeShape.SQUARE;

  return (
    <div
      style={{
        minWidth: shape === ViewNodeShape.CIRCLE ? 140 : 180,
        minHeight: shape === ViewNodeShape.CIRCLE ? 140 : undefined,
        background: "#fff",
        border: `2px solid ${selected ? "#6366f1" : "#e2e8f0"}`,
        boxShadow: selected
          ? "0 0 0 2px rgba(99,102,241,0.25)"
          : "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...SHAPE_STYLES[shape],
      }}
      className={data.className}
    >
      {/* Input handles */}
      {renderHandles(data.inputs, "target", Position.Top)}

      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          fontWeight: 600,
          fontSize: 13,
          color: "#1e293b",
          borderBottom: shape === ViewNodeShape.SQUARE ? "1px solid #f1f5f9" : undefined,
          textAlign: "center",
          userSelect: "none",
        }}
        className={data.headerClassName}
      >
        {data.label}
      </div>

      {/* Content */}
      {data.content && (
        <div
          style={{
            padding: shape === ViewNodeShape.CIRCLE ? "4px 8px" : "8px 12px",
            fontSize: 12,
            color: "#475569",
            flex: shape === ViewNodeShape.CIRCLE ? undefined : 1,
            overflow: "auto",
          }}
          className={data.contentClassName}
        >
          {data.content}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "4px 12px 6px",
          borderTop: shape === ViewNodeShape.SQUARE ? "1px solid #f1f5f9" : undefined,
          textAlign: "center",
          minHeight: 8,
        }}
        className={data.footerClassName}
      />

      {/* Output handles */}
      {renderHandles(data.outputs, "source", Position.Bottom)}
    </div>
  );
});
