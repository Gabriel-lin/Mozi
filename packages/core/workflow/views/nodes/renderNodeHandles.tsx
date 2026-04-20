import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { HandleConfig } from "../types";
import { cn } from "../utils/cn";

const positionMap: Record<string, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function resolvePosition(pos: string | undefined, fallback: Position): Position {
  return pos ? positionMap[pos] ?? fallback : fallback;
}

/**
 * Renders workflow node handles. Default layout: inputs top-left, outputs bottom-right.
 * If a handle has `position` set in config, it uses that edge with even spacing.
 */

/** Handles along the left (targets) or right (sources) edge for compact group table rows. */
export function renderNodeHandlesRow(handles: HandleConfig[], type: "source" | "target") {
  const count = handles.length;
  const position = type === "target" ? Position.Left : Position.Right;

  return handles.map((h, i) => {
    const offsetPct = count === 1 ? 50 : 14 + (i / Math.max(count - 1, 1)) * 72;
    const style: React.CSSProperties =
      position === Position.Left || position === Position.Right ? { top: `${offsetPct}%` } : {};

    return (
      <Handle
        key={h.id}
        id={h.id}
        type={type}
        position={position}
        className={cn(
          "!w-2 !h-2 !border-2 !border-white",
          type === "target" ? "!bg-indigo-400" : "!bg-green-500",
        )}
        style={style}
        title={h.label}
      />
    );
  });
}

export function renderNodeHandles(handles: HandleConfig[], type: "source" | "target") {
  const count = handles.length;
  const defaultEdge = type === "target" ? Position.Top : Position.Bottom;

  return handles.map((h, i) => {
    const explicit = Boolean(h.position);
    const pos = resolvePosition(h.position, defaultEdge);
    const isVertical = pos === Position.Top || pos === Position.Bottom;

    let style: React.CSSProperties;
    if (explicit) {
      const offset = count > 1 ? ((i + 1) / (count + 1)) * 100 : 50;
      style = isVertical ? { left: `${offset}%` } : { top: `${offset}%` };
    } else if (type === "target") {
      const leftPct = count === 1 ? 10 : 6 + (i / (count - 1)) * 22;
      style = { left: `${leftPct}%` };
    } else {
      const leftPct = count === 1 ? 90 : 94 - (i / (count - 1)) * 22;
      style = { left: `${leftPct}%` };
    }

    return (
      <Handle
        key={h.id}
        id={h.id}
        type={type}
        position={pos}
        className={cn(
          "!w-2 !h-2 !border-2 !border-white",
          type === "target" ? "!bg-indigo-400" : "!bg-green-500",
        )}
        style={style}
        title={h.label}
      />
    );
  });
}
