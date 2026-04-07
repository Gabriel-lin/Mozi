import React from "react";
import type { ViewPlugin } from "../types";

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  "top-left": { position: "absolute", top: 10, left: 10 },
  "top-right": { position: "absolute", top: 10, right: 10 },
  "bottom-left": { position: "absolute", bottom: 10, left: 10 },
  "bottom-right": { position: "absolute", bottom: 10, right: 10 },
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
    <div style={{ ...POSITION_STYLES[position], zIndex: 10, display: "flex", gap: 8 }}>
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
