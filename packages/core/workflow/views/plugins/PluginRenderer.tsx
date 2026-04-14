import React from "react";
import type { ViewPlugin } from "../types";
import { cn } from "../utils/cn";

const POSITION_CLASSES: Record<string, string> = {
  "top-left": "absolute top-2.5 left-2.5",
  "top-right": "absolute top-2.5 right-2.5",
  "bottom-left": "absolute bottom-2.5 left-2.5",
  "bottom-right": "absolute bottom-2.5 right-2.5",
};

interface PluginSlotProps {
  plugins: ViewPlugin[];
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

function PluginSlot({ plugins, position }: PluginSlotProps) {
  const items = plugins.filter(
    (p) => (p.position ?? "top-right") === position && p.enabled !== false,
  );
  if (items.length === 0) return null;

  return (
    <div className={cn(POSITION_CLASSES[position], "z-10 flex gap-2")}>
      {items.map((p) => (
        <div key={p.id}>{p.render()}</div>
      ))}
    </div>
  );
}

interface PluginRendererProps {
  plugins: ViewPlugin[];
}

export function PluginRenderer({ plugins }: PluginRendererProps) {
  return (
    <>
      <PluginSlot plugins={plugins} position="top-left" />
      <PluginSlot plugins={plugins} position="top-right" />
      <PluginSlot plugins={plugins} position="bottom-left" />
      <PluginSlot plugins={plugins} position="bottom-right" />
    </>
  );
}
