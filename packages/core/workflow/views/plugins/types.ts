import type { ViewPlugin } from "../types";

export interface PluginRegistry {
  register(plugin: ViewPlugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): ViewPlugin | undefined;
  getAll(): ViewPlugin[];
  getEnabled(): ViewPlugin[];
  setEnabled(pluginId: string, enabled: boolean): void;
}

export interface PluginSlotProps {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  plugins: ViewPlugin[];
}
