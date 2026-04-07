import { useCallback, useRef, useSyncExternalStore } from "react";
import type { XYPosition } from "@xyflow/react";
import type { ContextMenuItem, ContextMenuState } from "../types";

const INITIAL_STATE: ContextMenuState = {
  visible: false,
  position: { x: 0, y: 0 },
  items: [],
};

function createMenuStore() {
  let state: ContextMenuState = { ...INITIAL_STATE };
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  return {
    getState: () => state,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    open(
      position: XYPosition,
      items: ContextMenuItem[],
      target?: { nodeId?: string; edgeId?: string },
    ) {
      state = {
        visible: true,
        position,
        items,
        targetNodeId: target?.nodeId,
        targetEdgeId: target?.edgeId,
      };
      notify();
    },
    close() {
      if (!state.visible) return;
      state = { ...INITIAL_STATE };
      notify();
    },
  };
}

export interface UseContextMenuOptions {
  items?: ContextMenuItem[];
  nodeItems?: (nodeId: string) => ContextMenuItem[];
  edgeItems?: (edgeId: string) => ContextMenuItem[];
  canvasItems?: () => ContextMenuItem[];
}

export interface UseContextMenuReturn {
  state: ContextMenuState;
  onNodeContextMenu: (event: React.MouseEvent, nodeId: string) => void;
  onEdgeContextMenu: (event: React.MouseEvent, edgeId: string) => void;
  onPaneContextMenu: (event: React.MouseEvent) => void;
  close: () => void;
}

export function useContextMenu(options: UseContextMenuOptions = {}): UseContextMenuReturn {
  const storeRef = useRef<ReturnType<typeof createMenuStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createMenuStore();
  }
  const store = storeRef.current;

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const items = options.nodeItems?.(nodeId) ?? options.items ?? [];
      store.open({ x: event.clientX, y: event.clientY }, items, { nodeId });
    },
    [store, options.nodeItems, options.items],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edgeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const items = options.edgeItems?.(edgeId) ?? options.items ?? [];
      store.open({ x: event.clientX, y: event.clientY }, items, { edgeId });
    },
    [store, options.edgeItems, options.items],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const items = options.canvasItems?.() ?? options.items ?? [];
      store.open({ x: event.clientX, y: event.clientY }, items);
    },
    [store, options.canvasItems, options.items],
  );

  const close = useCallback(() => store.close(), [store]);

  return { state, onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu, close };
}
