export enum PluginStatus {
  REGISTERED = "registered",
  INSTALLED = "installed",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
}

export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  tags?: string[];
}

export interface PluginContext {
  logger: import("../logger").Logger;
  config: Record<string, unknown>;
  getPlugin<T extends Plugin = Plugin>(id: string): T | undefined;
}

export interface Plugin {
  readonly meta: PluginMeta;
  install?(ctx: PluginContext): void | Promise<void>;
  activate?(ctx: PluginContext): void | Promise<void>;
  deactivate?(ctx: PluginContext): void | Promise<void>;
  uninstall?(ctx: PluginContext): void | Promise<void>;
}

export interface PluginManagerEvents {
  "plugin:installed": { pluginId: string };
  "plugin:activated": { pluginId: string };
  "plugin:deactivated": { pluginId: string };
  "plugin:uninstalled": { pluginId: string };
  "plugin:error": { pluginId: string; error: Error };
}
