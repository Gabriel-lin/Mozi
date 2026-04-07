import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { Edge, Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { ConfigField } from "./ConfigField";
import { ImeInput } from "./ImeInput";
import { cn } from "@/lib/utils";

// ── Line style options with SVG preview ──

const LINE_STYLES = [
  { value: "solid", label: "实线", dasharray: undefined },
  { value: "dashed", label: "虚线", dasharray: "6 4" },
  { value: "dotted", label: "点线", dasharray: "2 3" },
] as const;

const DIRECTIONS = [
  { value: "directional", label: "单向", icon: "→" },
  { value: "bidirectional", label: "双向", icon: "↔" },
  { value: "selfLoop", label: "自循环", icon: "↻" },
] as const;

const COLORS = [
  "#94a3b8",
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
];

type LineStyle = (typeof LINE_STYLES)[number]["value"];
type Direction = (typeof DIRECTIONS)[number]["value"];

function getInitialLineStyle(edge: Edge): LineStyle {
  const da = (edge.data as Record<string, unknown>)?.strokeDasharray;
  if (da === "6 4" || da === "4 4" || da === "dashed") return "dashed";
  if (da === "2 3" || da === "2 2" || da === "dotted") return "dotted";
  return "solid";
}

function getInitialDirection(edge: Edge): Direction {
  const edgeType = edge.type ?? "directional";
  if (edgeType === "bidirectional") return "bidirectional";
  if (edgeType === "selfLoop") return "selfLoop";
  return "directional";
}

function getInitialLabel(edge: Edge): string {
  const dataLabel = (edge.data as Record<string, unknown>)?.label;
  if (dataLabel && typeof dataLabel === "object" && (dataLabel as { text?: string }).text) {
    return (dataLabel as { text: string }).text;
  }
  return String(edge.label ?? "");
}

function getNodeLabel(nodes: Node[], nodeId: string): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  const d = node.data as Record<string, unknown>;
  const label = d?.label ?? d?.text;
  return label ? String(label) : nodeId;
}

// ── SVG line style preview ──

function LineStyleIcon({ dasharray, color }: { dasharray?: string; color: string }) {
  return (
    <svg width="40" height="12" viewBox="0 0 40 12" className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2="38"
        y2="6"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dasharray}
        strokeLinecap="round"
      />
    </svg>
  );
}

interface EdgeConfigFormProps {
  edge: Edge;
  nodes: Node[];
  onPreview: (id: string, updates: Record<string, unknown>) => void;
  onConfirm: () => void;
}

export function EdgeConfigForm({ edge, nodes, onPreview, onConfirm }: EdgeConfigFormProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(getInitialLabel(edge));
  const [lineStyle, setLineStyle] = useState<LineStyle>(getInitialLineStyle(edge));
  const [color, setColor] = useState<string>(
    String((edge.data as Record<string, unknown>)?.color ?? "#94a3b8"),
  );
  const [direction, setDirection] = useState<Direction>(getInitialDirection(edge));

  const edgeUpdates = useMemo(() => {
    const strokeDasharray =
      lineStyle === "dashed" ? "6 4" : lineStyle === "dotted" ? "2 3" : undefined;

    const edgeType =
      direction === "bidirectional"
        ? "bidirectional"
        : direction === "selfLoop"
          ? "selfLoop"
          : "directional";

    const sourceArrow =
      direction === "bidirectional" ? { shape: "triangleFilled", color } : undefined;

    const targetArrow = { shape: "triangleFilled", color };

    const labelConfig = label.trim() ? { text: label.trim() } : undefined;

    return {
      type: edgeType,
      data: {
        ...(edge.data as Record<string, unknown>),
        label: labelConfig,
        color,
        strokeDasharray,
        sourceArrow,
        targetArrow,
        edgeType,
      },
    };
  }, [label, lineStyle, color, direction, edge.data]);

  useEffect(() => {
    onPreview(edge.id, edgeUpdates);
  }, [edge.id, edgeUpdates, onPreview]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Source → Target */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
            <span className="text-[10px] text-muted-foreground/70 block leading-none mb-0.5">
              {t("workflow.edgeSource", "起始")}
            </span>
            <span className="text-xs text-foreground font-medium truncate block">
              {getNodeLabel(nodes, edge.source)}
            </span>
          </div>
          <span className="text-muted-foreground/50 text-xs shrink-0">→</span>
          <div className="flex-1 min-w-0 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
            <span className="text-[10px] text-muted-foreground/70 block leading-none mb-0.5">
              {t("workflow.edgeTarget", "目标")}
            </span>
            <span className="text-xs text-foreground font-medium truncate block">
              {getNodeLabel(nodes, edge.target)}
            </span>
          </div>
        </div>

        {/* Label */}
        <ConfigField label={t("workflow.edgeLabel", "标签")}>
          <ImeInput value={label} onValueChange={setLabel} className="h-8 text-xs" />
        </ConfigField>

        {/* Line style — vertical list with SVG icon */}
        <ConfigField label="线型">
          <div className="flex flex-col gap-1">
            {LINE_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => setLineStyle(s.value)}
                className={cn(
                  "flex items-center gap-2 px-2.5 h-8 text-xs rounded-md border transition-colors",
                  lineStyle === s.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40",
                )}
              >
                <LineStyleIcon
                  dasharray={s.dasharray}
                  color={lineStyle === s.value ? "currentColor" : "#94a3b8"}
                />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </ConfigField>

        {/* Color */}
        <ConfigField label="颜色">
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  color === c ? "border-foreground scale-110" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </ConfigField>

        {/* Direction */}
        <ConfigField label="方向">
          <div className="flex flex-col gap-1">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDirection(d.value)}
                className={cn(
                  "flex items-center gap-2 px-2.5 h-8 text-xs rounded-md border transition-colors",
                  direction === d.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40",
                )}
              >
                <span className="text-base leading-none w-5 text-center">{d.icon}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </ConfigField>
      </div>

      <SheetFooter className="p-3 border-t border-border/30">
        <Button size="sm" className="ml-auto gap-1.5 h-8" onClick={handleConfirm}>
          <Check className="h-3.5 w-3.5" />
          {t("common.confirm", "确认")}
        </Button>
      </SheetFooter>
    </>
  );
}
