import { PluginError } from "../errors";
import { ErrorCode } from "../errors";
import { Logger } from "../logger";
import { PluginStatus, type Plugin, type PluginContext, type PluginManagerEvents } from "./types";

type EventCallback<T = unknown> = (payload: T) => void;

interface PluginEntry {
  plugin: Plugin;
  status: PluginStatus;
  config: Record<string, unknown>;
}

export class PluginManager {
  private plugins = new Map<string, PluginEntry>();
  private listeners = new Map<string, Set<EventCallback>>();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger({ module: "plugin" });
  }

  on<K extends keyof PluginManagerEvents>(event: K, callback: EventCallback<PluginManagerEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
    return () => this.listeners.get(event)?.delete(callback as EventCallback);
  }

  private emit<K extends keyof PluginManagerEvents>(event: K, payload: PluginManagerEvents[K]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        /* listener error should not propagate */
      }
    });
  }

  register(plugin: Plugin, config: Record<string, unknown> = {}): void {
    const { id } = plugin.meta;
    if (this.plugins.has(id)) {
      throw new PluginError(id, `插件已注册: ${id}`, { code: ErrorCode.PLUGIN_CONFLICT });
    }
    this.plugins.set(id, { plugin, status: PluginStatus.REGISTERED, config });
    this.logger.debug(`插件已注册: ${id}`);
  }

  async install(pluginId: string): Promise<void> {
    const entry = this.getEntry(pluginId);
    this.checkDependencies(entry.plugin);

    try {
      const ctx = this.createContext(entry);
      if (entry.plugin.install) await entry.plugin.install(ctx);
      entry.status = PluginStatus.INSTALLED;
      this.emit("plugin:installed", { pluginId });
      this.logger.info(`插件已安装: ${pluginId}`);
    } catch (error) {
      entry.status = PluginStatus.ERROR;
      this.emit("plugin:error", { pluginId, error: error as Error });
      throw new PluginError(pluginId, `安装失败: ${(error as Error).message}`, {
        code: ErrorCode.PLUGIN_LOAD_FAILED,
        cause: error as Error,
      });
    }
  }

  async activate(pluginId: string): Promise<void> {
    const entry = this.getEntry(pluginId);
    if (entry.status !== PluginStatus.INSTALLED && entry.status !== PluginStatus.INACTIVE) {
      throw new PluginError(pluginId, `无法激活: 当前状态为 ${entry.status}`);
    }

    try {
      const ctx = this.createContext(entry);
      if (entry.plugin.activate) await entry.plugin.activate(ctx);
      entry.status = PluginStatus.ACTIVE;
      this.emit("plugin:activated", { pluginId });
      this.logger.info(`插件已激活: ${pluginId}`);
    } catch (error) {
      entry.status = PluginStatus.ERROR;
      this.emit("plugin:error", { pluginId, error: error as Error });
      throw new PluginError(pluginId, `激活失败: ${(error as Error).message}`, {
        cause: error as Error,
      });
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const entry = this.getEntry(pluginId);
    if (entry.status !== PluginStatus.ACTIVE) return;

    try {
      const ctx = this.createContext(entry);
      if (entry.plugin.deactivate) await entry.plugin.deactivate(ctx);
      entry.status = PluginStatus.INACTIVE;
      this.emit("plugin:deactivated", { pluginId });
      this.logger.info(`插件已停用: ${pluginId}`);
    } catch (error) {
      entry.status = PluginStatus.ERROR;
      this.emit("plugin:error", { pluginId, error: error as Error });
      throw error;
    }
  }

  async uninstall(pluginId: string): Promise<void> {
    const entry = this.getEntry(pluginId);
    if (entry.status === PluginStatus.ACTIVE) {
      await this.deactivate(pluginId);
    }

    this.checkNotDepended(pluginId);

    try {
      const ctx = this.createContext(entry);
      if (entry.plugin.uninstall) await entry.plugin.uninstall(ctx);
      this.plugins.delete(pluginId);
      this.emit("plugin:uninstalled", { pluginId });
      this.logger.info(`插件已卸载: ${pluginId}`);
    } catch (error) {
      entry.status = PluginStatus.ERROR;
      throw error;
    }
  }

  get<T extends Plugin = Plugin>(pluginId: string): T | undefined {
    const entry = this.plugins.get(pluginId);
    return entry?.plugin as T | undefined;
  }

  getStatus(pluginId: string): PluginStatus | undefined {
    return this.plugins.get(pluginId)?.status;
  }

  listAll(): Array<{ meta: Plugin["meta"]; status: PluginStatus }> {
    return Array.from(this.plugins.values()).map((e) => ({
      meta: e.plugin.meta,
      status: e.status,
    }));
  }

  listActive(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter((e) => e.status === PluginStatus.ACTIVE)
      .map((e) => e.plugin);
  }

  async installAndActivate(plugin: Plugin, config?: Record<string, unknown>): Promise<void> {
    this.register(plugin, config);
    await this.install(plugin.meta.id);
    await this.activate(plugin.meta.id);
  }

  async shutdownAll(): Promise<void> {
    const activeIds = Array.from(this.plugins.entries())
      .filter(([, e]) => e.status === PluginStatus.ACTIVE)
      .map(([id]) => id);

    for (const id of activeIds) {
      try {
        await this.deactivate(id);
      } catch {
        this.logger.warn(`插件停用失败: ${id}`);
      }
    }
  }

  private getEntry(pluginId: string): PluginEntry {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, `插件未找到: ${pluginId}`, { code: ErrorCode.PLUGIN_NOT_FOUND });
    }
    return entry;
  }

  private checkDependencies(plugin: Plugin): void {
    for (const depId of plugin.meta.dependencies ?? []) {
      const dep = this.plugins.get(depId);
      if (!dep) {
        throw new PluginError(plugin.meta.id, `缺少依赖插件: ${depId}`, { code: ErrorCode.PLUGIN_DEPENDENCY });
      }
      if (dep.status !== PluginStatus.ACTIVE && dep.status !== PluginStatus.INSTALLED) {
        throw new PluginError(plugin.meta.id, `依赖插件 ${depId} 未安装/激活`, {
          code: ErrorCode.PLUGIN_DEPENDENCY,
        });
      }
    }
  }

  private checkNotDepended(pluginId: string): void {
    for (const [id, entry] of this.plugins) {
      if (id === pluginId) continue;
      if (
        entry.plugin.meta.dependencies?.includes(pluginId) &&
        (entry.status === PluginStatus.ACTIVE || entry.status === PluginStatus.INSTALLED)
      ) {
        throw new PluginError(pluginId, `无法卸载: 插件 ${id} 依赖此插件`, { code: ErrorCode.PLUGIN_DEPENDENCY });
      }
    }
  }

  private createContext(entry: PluginEntry): PluginContext {
    return {
      logger: this.logger.child({ module: `plugin:${entry.plugin.meta.id}` }),
      config: entry.config,
      getPlugin: <T extends Plugin = Plugin>(id: string): T | undefined => this.get<T>(id),
    };
  }
}
