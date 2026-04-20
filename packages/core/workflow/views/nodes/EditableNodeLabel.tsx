import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { cn } from "../utils/cn";

export type EditableNodeLabelTone = "onGradient" | "onCard";

const toneClass: Record<
  EditableNodeLabelTone,
  { span: string; input: string }
> = {
  onGradient: {
    span: "",
    input:
      "nodrag nopan min-w-0 flex-1 rounded-md border border-white/30 bg-black/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-white/30",
  },
  onCard: {
    span: "",
    input:
      "nodrag nopan min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-ring",
  },
};

export type EditableNodeLabelProps = {
  nodeId: string;
  value: string;
  dataField: "label" | "text";
  /** Used when the user clears the field (trim empty). */
  fallback: string;
  tone?: EditableNodeLabelTone;
  className?: string;
};

export const EditableNodeLabel = memo(function EditableNodeLabel({
  nodeId,
  value,
  dataField,
  fallback,
  tone = "onGradient",
  className,
}: EditableNodeLabelProps) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const next = draft.trim() || fallback;
    updateNodeData(nodeId, { [dataField]: next });
  }, [nodeId, draft, fallback, dataField, updateNodeData]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(value || fallback);
      setEditing(true);
    },
    [value, fallback],
  );

  const display = value || fallback;
  const t = toneClass[tone];

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        className={cn(t.input, className)}
      />
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      className={cn("min-w-0 cursor-text truncate", t.span, className)}
      title={display}
    >
      {display}
    </span>
  );
});
