import type { ViewPlugin } from "../types";
import type { PluginRegistry } from "./types";

export function createPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, ViewPlugin>();

  return {
    register(plugin: ViewPlugin) {
      if (plugins.has(plugin.id)) {
        throw new Error(`Plugin "${plugin.id}" is already registered`);
      }
      plugins.set(plugin.id, { enabled: true, ...plugin });
      plugin.onInit?.();
    },

    unregister(pluginId: string) {
      const plugin = plugins.get(pluginId);
      if (plugin) {
        plugin.onDestroy?.();
        plugins.delete(pluginId);
      }
    },

    get(pluginId: string) {
      return plugins.get(pluginId);
    },

    getAll() {
      return Array.from(plugins.values());
    },

    getEnabled() {
      return Array.from(plugins.values()).filter((p) => p.enabled !== false);
    },

    setEnabled(pluginId: string, enabled: boolean) {
      const plugin = plugins.get(pluginId);
      if (plugin) {
        plugin.enabled = enabled;
      }
    },
  };
}
