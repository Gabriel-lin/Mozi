import { type StateStorage } from "zustand/middleware";
import { load, type Store } from "@tauri-apps/plugin-store";

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load("mozi-settings.json", { defaults: {}, autoSave: true });
  }
  return storeInstance;
}

/**
 * Zustand StateStorage adapter backed by Tauri plugin-store.
 * Data is persisted to `$APPDATA/mozi-settings.json`.
 */
export const tauriStorage: StateStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const store = await getStore();
      const value = await store.get<string>(key);
      return value ?? null;
    } catch {
      return localStorage.getItem(key);
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const store = await getStore();
      await store.set(key, value);
      await store.save();
    } catch {
      localStorage.setItem(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const store = await getStore();
      await store.delete(key);
      await store.save();
    } catch {
      localStorage.removeItem(key);
    }
  },
};

/** Flush the underlying Tauri store to disk. */
export async function flushStore(): Promise<void> {
  if (storeInstance) {
    await storeInstance.save();
  }
}

/** Reset the singleton so the next access re-loads from disk. */
export async function resetStoreInstance(): Promise<void> {
  if (storeInstance) {
    await storeInstance.close();
    storeInstance = null;
  }
}
