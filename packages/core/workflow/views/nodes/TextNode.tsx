import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ViewNodeShape, type HandleConfig } from "../types";
import type { TextNodeProps } from "./types";

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
          width: 8,
          height: 8,
          background: type === "target" ? "#6366f1" : "#22c55e",
          border: "2px solid #fff",
          ...style,
        }}
        title={h.label}
      />
    );
  });
}

export const TextNode = memo(function TextNode({ data, selected }: TextNodeProps) {
  const shape = data.shape ?? ViewNodeShape.SQUARE;
  const isCircle = shape === ViewNodeShape.CIRCLE;

  return (
    <div
      style={{
        minWidth: isCircle ? 100 : 120,
        minHeight: isCircle ? 100 : undefined,
        padding: isCircle ? "16px" : "10px 16px",
        background: "#fff",
        border: `2px solid ${selected ? "#6366f1" : "#e2e8f0"}`,
        borderRadius: isCircle ? "50%" : 8,
        boxShadow: selected
          ? "0 0 0 2px rgba(99,102,241,0.25)"
          : "0 1px 3px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        aspectRatio: isCircle ? "1 / 1" : undefined,
        transition: "border-color 0.15s, box-shadow 0.15s",
        userSelect: "none",
      }}
      className={data.className}
    >
      {renderHandles(data.inputs, "target", Position.Top)}

      <span
        style={{
          fontSize: data.fontSize ?? 13,
          color: data.color ?? "#334155",
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {data.text}
      </span>

      {renderHandles(data.outputs, "source", Position.Bottom)}
    </div>
  );
});
