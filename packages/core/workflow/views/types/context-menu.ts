import type { ReactNode } from "react";
import type { XYPosition } from "@xyflow/react";

/** A single item (or submenu) in the right-click context menu. */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children?: ContextMenuItem[];
  onClick?: () => void;
}

/** Runtime state of the context menu managed by {@link useContextMenu}. */
export interface ContextMenuState {
  visible: boolean;
  position: XYPosition;
  items: ContextMenuItem[];
  targetNodeId?: string;
  targetEdgeId?: string;
}
