import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useNodeId, useReactFlow, type Node } from "@xyflow/react";
import {
  getWorkflowNodeMinDimensions,
  TERMINAL_NODE_EXPANDED_DIMS,
  type NodeChromeVariant,
  type WorkflowNodeMinDimensions,
} from "../nodes/nodeChrome";
import { patchWorkflowRfNodePixelBounds } from "../utils/nodeStyle";

export type UseWorkflowNodeResizeOptions = {
  disabled: boolean;
  terminal?: boolean;
  selected: boolean;
  collapsed: boolean;
  variant: NodeChromeVariant;
};

export type UseWorkflowNodeResizeReturn = {
  showHandles: boolean;
  shellPointerHandlers: {
    onPointerEnter: () => void;
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
  shellStyle: CSSProperties | undefined;
  minDimensions: WorkflowNodeMinDimensions;
  resizerHandlers: {
    onResizeStart: () => void;
    onResizeEnd: () => void;
  };
};

export function useWorkflowNodeResize(
  shellRef: RefObject<HTMLDivElement | null>,
  options: UseWorkflowNodeResizeOptions,
): UseWorkflowNodeResizeReturn {
  const nodeId = useNodeId();
  const { updateNode } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const resizingRef = useRef(false);

  const minDimensions = useMemo((): WorkflowNodeMinDimensions => {
    if (options.disabled && options.terminal) {
      if (options.collapsed) {
        return getWorkflowNodeMinDimensions(true, options.variant);
      }
      return TERMINAL_NODE_EXPANDED_DIMS;
    }
    return getWorkflowNodeMinDimensions(options.collapsed, options.variant);
  }, [options.disabled, options.terminal, options.collapsed, options.variant]);

  useEffect(() => {
    resizingRef.current = resizing;
  }, [resizing]);

  const showHandles =
    !options.disabled && (options.selected || hovered || resizing);

  const shellPointerHandlers = useMemo(
    () => ({
      onPointerEnter: () => setHovered(true),
      onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => {
        const rt = e.relatedTarget;
        const shell = shellRef.current;
        if (rt instanceof Element && shell?.contains(rt)) return;
        setHovered(false);
      },
    }),
    [shellRef],
  );

  const shellStyle: CSSProperties | undefined = useMemo(() => {
    if (options.disabled && !options.terminal) return undefined;
    const useMinHeight =
      Boolean(options.terminal) ||
      options.collapsed ||
      options.variant === "circle" ||
      options.variant === "group";
    return {
      boxSizing: "border-box",
      minWidth: minDimensions.minWidth,
      ...(useMinHeight ? { minHeight: minDimensions.minHeight } : {}),
    };
  }, [
    options.disabled,
    options.terminal,
    options.collapsed,
    options.variant,
    minDimensions.minWidth,
    minDimensions.minHeight,
  ]);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el || !nodeId) return undefined;
    if (options.disabled && !options.terminal) return undefined;

    const ro = new ResizeObserver(() => {
      if (resizingRef.current) return;
      const { width, height } = el.getBoundingClientRect();
      if (width + 0.5 >= minDimensions.minWidth && height + 0.5 >= minDimensions.minHeight) {
        return;
      }
      const rw = Math.max(Math.round(width), minDimensions.minWidth);
      const rh = Math.max(Math.round(height), minDimensions.minHeight);
      updateNode(nodeId, (node: Node) => ({
        ...node,
        ...patchWorkflowRfNodePixelBounds(node, rw, rh),
      }));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [
    shellRef,
    nodeId,
    options.disabled,
    options.terminal,
    minDimensions.minWidth,
    minDimensions.minHeight,
    updateNode,
  ]);

  const onResizeStart = useCallback(() => {
    resizingRef.current = true;
    setResizing(true);
  }, []);

  const onResizeEnd = useCallback(() => {
    resizingRef.current = false;
    setResizing(false);
  }, []);

  return {
    showHandles,
    shellPointerHandlers,
    shellStyle,
    minDimensions,
    resizerHandlers: { onResizeStart, onResizeEnd },
  };
}
