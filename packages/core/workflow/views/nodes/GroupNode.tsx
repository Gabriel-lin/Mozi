import React, { memo, useState, useCallback, useRef, useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { cn } from "../utils/cn";

export interface GroupNodeData {
  label?: string;
  color?: string;
  [key: string]: unknown;
}

export type GroupNodeProps = NodeProps & { data: GroupNodeData };

export const GroupNode = memo(function GroupNode({ data, selected }: GroupNodeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
  }, []);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineClassName="!border-indigo-400 !border-[1.5px]"
        handleClassName="!w-2 !h-2 !bg-indigo-400 !rounded-sm"
      />
      <div
        className={cn(
          "w-full h-full rounded-2xl border relative transition-[border-color,box-shadow] duration-200 backdrop-blur-md backdrop-saturate-150",
          selected
            ? "border-indigo-400/40 border-solid bg-indigo-500/[0.08] shadow-[0_14px_34px_rgba(0,0,0,0.10)]"
            : "border-indigo-400/25 border-dashed bg-indigo-500/[0.06] shadow-[0_10px_26px_rgba(0,0,0,0.06)]",
        )}
      >
        <div className="absolute -top-2.5 left-3 flex items-center">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") {
                  setDraft(data.label ?? "");
                  setEditing(false);
                }
              }}
              className="min-w-[80px] bg-background/90 backdrop-blur border border-border/70 rounded-lg px-2 py-1 text-[11px] font-medium outline-none focus:ring-2 focus:ring-indigo-400/25 shadow-sm"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setDraft(data.label ?? "");
                setEditing(true);
              }}
              className="px-2 py-1 text-[11px] font-semibold rounded-lg cursor-text select-none bg-indigo-500/10 text-indigo-600 border border-indigo-500/15 shadow-sm"
            >
              {data.label || "Group"}
            </span>
          )}
        </div>
      </div>
    </>
  );
});
