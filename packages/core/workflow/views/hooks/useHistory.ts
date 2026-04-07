import { useCallback, useRef, useSyncExternalStore } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { HistoryEntry, HistoryState } from "../types";
import { generateId, serializeGraph, deserializeGraph } from "../utils";

const MAX_ENTRIES = 100;

function createStore(storageKey?: string) {
  let state: HistoryState = { entries: [], currentIndex: -1 };
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  function persist() {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* quota exceeded or SSR — silently ignore */
    }
  }

  function hydrate(): boolean {
    if (!storageKey) return false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as HistoryState;
      if (Array.isArray(parsed.entries) && typeof parsed.currentIndex === "number") {
        state = parsed;
        notify();
        return true;
      }
    } catch {
      /* corrupt data */
    }
    return false;
  }

  return {
    getState: () => state,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    push(nodes: Node[], edges: Edge[], label?: string) {
      const entry: HistoryEntry = {
        id: generateId("hist"),
        timestamp: Date.now(),
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        label,
      };

      const next = state.entries.slice(0, state.currentIndex + 1);
      next.push(entry);
      if (next.length > MAX_ENTRIES) next.shift();

      state = { entries: next, currentIndex: next.length - 1 };
      persist();
      notify();
    },
    undo(): HistoryEntry | null {
      if (state.currentIndex <= 0) return null;
      state = { ...state, currentIndex: state.currentIndex - 1 };
      persist();
      notify();
      return state.entries[state.currentIndex] ?? null;
    },
    redo(): HistoryEntry | null {
      if (state.currentIndex >= state.entries.length - 1) return null;
      state = { ...state, currentIndex: state.currentIndex + 1 };
      persist();
      notify();
      return state.entries[state.currentIndex] ?? null;
    },
    reset() {
      state = { entries: [], currentIndex: -1 };
      if (storageKey) {
        try { localStorage.removeItem(storageKey); } catch { /* noop */ }
      }
      notify();
    },
    restore(): HistoryEntry | null {
      const ok = hydrate();
      if (!ok) return null;
      return state.entries[state.currentIndex] ?? null;
    },
    hydrate,
  };
}

export interface UseHistoryOptions {
  storageKey?: string;
}

export interface UseHistoryReturn {
  push: (nodes: Node[], edges: Edge[], label?: string) => void;
  undo: () => { nodes: Node[]; edges: Edge[] } | null;
  redo: () => { nodes: Node[]; edges: Edge[] } | null;
  reset: () => void;
  restore: () => { nodes: Node[]; edges: Edge[] } | null;
  canUndo: boolean;
  canRedo: boolean;
  entries: HistoryEntry[];
  currentIndex: number;
}

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createStore(options.storageKey);
    storeRef.current.hydrate();
  }
  const store = storeRef.current;

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  const push = useCallback(
    (nodes: Node[], edges: Edge[], label?: string) => store.push(nodes, edges, label),
    [store],
  );

  const undo = useCallback(() => {
    const entry = store.undo();
    if (!entry) return null;
    return { nodes: entry.nodes, edges: entry.edges };
  }, [store]);

  const redo = useCallback(() => {
    const entry = store.redo();
    if (!entry) return null;
    return { nodes: entry.nodes, edges: entry.edges };
  }, [store]);

  const reset = useCallback(() => store.reset(), [store]);

  const restore = useCallback(() => {
    const entry = store.restore();
    if (!entry) return null;
    return { nodes: entry.nodes, edges: entry.edges };
  }, [store]);

  return {
    push,
    undo,
    redo,
    reset,
    restore,
    canUndo: state.currentIndex > 0,
    canRedo: state.currentIndex < state.entries.length - 1,
    entries: state.entries,
    currentIndex: state.currentIndex,
  };
}
