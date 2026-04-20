import React, { memo, useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { useReactFlow, useStore, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "../utils/cn";
import {
  mergeWorkflowNodeStyleForGroupExpand,
  parseCssSize,
  stripWorkflowNodeSizingStyle,
} from "../utils/nodeStyle";
import {
  NodeCollapseToggle,
  WorkflowNodeResizer,
  GROUP_COLLAPSED_MIN_H,
  GROUP_COLLAPSED_MIN_W,
  WORKFLOW_GROUP_COLLAPSED_HEADER_H,
  WORKFLOW_GROUP_COLLAPSED_H_PAD,
  WORKFLOW_GROUP_COLLAPSED_ROW_GAP,
  WORKFLOW_GROUP_COLLAPSED_ROW_H,
  WORKFLOW_GROUP_COLLAPSED_TABLE_HEAD_H,
  WORKFLOW_GROUP_COLLAPSED_V_PAD,
  WORKFLOW_GROUP_HEADER_GRADIENT,
} from "./nodeChrome";
import { useWorkflowNodeResize } from "../hooks";
import type { GroupNodeProps, WorkflowGroupCollapsedLayoutBackup } from "./types";

export const GroupNode = memo(function GroupNode({ id, data, selected }: GroupNodeProps) {
  const collapsed = Boolean(data.collapsed);
  const shellRef = useRef<HTMLDivElement>(null);
  const layoutBackupRef = useRef<WorkflowGroupCollapsedLayoutBackup | null>(null);
  const lastLayoutSigRef = useRef("");
  const { updateNodeData, getNodes, setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const resize = useWorkflowNodeResize(shellRef, {
    disabled: false,
    selected,
    collapsed,
    variant: "group",
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(data.label ?? "");
  }, [data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { label: draft.trim() || "Group" });
  }, [id, draft, updateNodeData]);

  const cancelEdit = useCallback(() => {
    setDraft(data.label ?? "");
    setEditing(false);
  }, [data.label]);

  const displayLabel = data.label || "Group";

  const childLayoutKey = useStore(
    (s) =>
      s.nodes
        .filter((n) => n.parentId === id)
        .map((n) => n.id)
        .sort()
        .join(","),
    (a, b) => a === b,
  );

  const groupMeasuredW = useStore(
    (s) => {
      const n = s.nodeLookup.get(id);
      const w = n?.measured?.width ?? parseCssSize(n?.style?.width);
      return w ?? GROUP_COLLAPSED_MIN_W;
    },
    (a, b) => a === b,
  );

  useLayoutEffect(() => {
    const all = getNodes();
    const group = all.find((n) => n.id === id);
    if (!group) return;

    if (!collapsed) {
      lastLayoutSigRef.current = "";
      const backup = layoutBackupRef.current;
      if (!backup) return;

      const childIds = [...backup.children.keys()];
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              style: mergeWorkflowNodeStyleForGroupExpand(n.style, backup.groupStyle),
            };
          }
          const snap = backup.children.get(n.id);
          if (!snap) return n;
          return {
            ...n,
            position: { ...snap.position },
            style: mergeWorkflowNodeStyleForGroupExpand(n.style, snap.style),
          };
        }),
      );
      layoutBackupRef.current = null;
      queueMicrotask(() => {
        updateNodeInternals(id);
        childIds.forEach((cid) => updateNodeInternals(cid));
      });
      return;
    }

    const children = all
      .filter((n) => n.parentId === id)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    if (layoutBackupRef.current === null) {
      layoutBackupRef.current = {
        groupStyle: group.style ? { ...group.style } : {},
        children: new Map(
          children.map((c) => [
            c.id,
            {
              position: { ...c.position },
              style: c.style ? { ...c.style } : {},
            },
          ]),
        ),
      };
    }

    const pw = Math.max(
      parseCssSize(group.style?.width) ?? groupMeasuredW,
      GROUP_COLLAPSED_MIN_W,
    );
    const innerW = Math.max(0, pw - WORKFLOW_GROUP_COLLAPSED_H_PAD * 2);
    const header = WORKFLOW_GROUP_COLLAPSED_HEADER_H;
    const tableHead = children.length > 0 ? WORKFLOW_GROUP_COLLAPSED_TABLE_HEAD_H : 0;
    const rowH = WORKFLOW_GROUP_COLLAPSED_ROW_H;
    const rowGap = WORKFLOW_GROUP_COLLAPSED_ROW_GAP;
    const vPad = WORKFLOW_GROUP_COLLAPSED_V_PAD;
    const hPad = WORKFLOW_GROUP_COLLAPSED_H_PAD;
    const contentTop = header + tableHead + vPad;
    const bodyH =
      children.length > 0
        ? tableHead + vPad + children.length * rowH + (children.length - 1) * rowGap + vPad
        : vPad * 2;
    const targetH = Math.max(header + bodyH, GROUP_COLLAPSED_MIN_H);

    const sig = `${childLayoutKey}|${Math.round(pw)}|${targetH}|${tableHead}`;
    if (lastLayoutSigRef.current === sig) return;
    lastLayoutSigRef.current = sig;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            style: {
              ...stripWorkflowNodeSizingStyle(n.style),
              width: pw,
              height: targetH,
              minHeight: targetH,
              boxSizing: "border-box",
            },
          };
        }
        const idx = children.findIndex((c) => c.id === n.id);
        if (idx < 0) return n;
        return {
          ...n,
          position: { x: hPad, y: contentTop + idx * (rowH + rowGap) },
          style: {
            ...stripWorkflowNodeSizingStyle(n.style),
            width: innerW,
            height: rowH,
            minHeight: rowH,
            maxHeight: rowH,
            boxSizing: "border-box",
            overflow: "hidden",
          },
        };
      }),
    );

    queueMicrotask(() => {
      updateNodeInternals(id);
      children.forEach((c) => updateNodeInternals(c.id));
    });
  }, [
    id,
    collapsed,
    childLayoutKey,
    groupMeasuredW,
    getNodes,
    setNodes,
    updateNodeInternals,
  ]);

  return (
    <div
      ref={shellRef}
      style={resize.shellStyle}
      className="relative box-border min-h-0 h-full w-full min-w-0"
      {...resize.shellPointerHandlers}
    >
      <WorkflowNodeResizer
        showHandles={resize.showHandles}
        collapsed={collapsed}
        variant="group"
        onResizeStart={resize.resizerHandlers.onResizeStart}
        onResizeEnd={resize.resizerHandlers.onResizeEnd}
      />
      <div
        className={cn(
          "relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 backdrop-blur-md backdrop-saturate-150",
          selected
            ? "border-indigo-400/40 border-solid bg-indigo-500/[0.08] shadow-[0_14px_34px_rgba(0,0,0,0.10)]"
            : "border-indigo-400/25 border-dashed bg-indigo-500/[0.06] shadow-[0_10px_26px_rgba(0,0,0,0.06)]",
        )}
      >
        <NodeCollapseToggle
          nodeId={id}
          collapsed={collapsed}
          className="left-1.5 top-1.5"
          variant="group"
        />

        <div
          className={cn(
            "flex w-full min-w-0 shrink-0 items-center gap-1.5 select-none bg-gradient-to-br text-white overflow-hidden py-2",
            WORKFLOW_GROUP_HEADER_GRADIENT,
            "rounded-t-2xl",
            "px-3.5 pl-9",
          )}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") cancelEdit();
              }}
              className="nodrag nopan min-w-0 flex-1 rounded-md border border-white/30 bg-black/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-white/30"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setDraft(displayLabel);
                setEditing(true);
              }}
              className="min-w-0 flex-1 cursor-text truncate text-xs font-semibold tracking-wide"
            >
              {displayLabel}
            </span>
          )}
        </div>

        {collapsed && childLayoutKey.length > 0 && (
          <div
            className="grid shrink-0 grid-cols-[1fr_auto] border-b border-border/25 bg-muted/30 px-2 py-1 text-[10px] font-medium leading-none text-muted-foreground"
            style={{ minHeight: WORKFLOW_GROUP_COLLAPSED_TABLE_HEAD_H }}
          >
            <span className="truncate pr-1">输入 · 标签</span>
            <span className="shrink-0 text-right tabular-nums">输出</span>
          </div>
        )}

        {!collapsed && <div className="min-h-0 flex-1" aria-hidden />}
      </div>
    </div>
  );
});
