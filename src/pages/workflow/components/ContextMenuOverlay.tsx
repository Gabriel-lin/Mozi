import React, { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContextMenuItem, ContextMenuState } from "@mozi/core/workflow/views";

interface ContextMenuOverlayProps {
  state: ContextMenuState;
  onClose: () => void;
}

function clampToViewport(x: number, y: number, el: HTMLDivElement | null) {
  if (!el) return { x, y };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();
  let cx = x;
  let cy = y;
  if (cx + rect.width > vw - 8) cx = vw - rect.width - 8;
  if (cy + rect.height > vh - 8) cy = vh - rect.height - 8;
  if (cx < 8) cx = 8;
  if (cy < 8) cy = 8;
  return { x: cx, y: cy };
}

export function ContextMenuOverlay({ state, onClose }: ContextMenuOverlayProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const refCallback = useCallback((el: HTMLDivElement | null) => {
    menuRef.current = el;
    if (el) {
      const adjusted = clampToViewport(
        parseFloat(el.style.left) || 0,
        parseFloat(el.style.top) || 0,
        el,
      );
      el.style.left = `${adjusted.x}px`;
      el.style.top = `${adjusted.y}px`;
    }
  }, []);

  useEffect(() => {
    if (!state.visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick, true);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick, true);
    };
  }, [state.visible, onClose]);

  if (!state.visible || state.items.length === 0) return null;

  return createPortal(
    <div
      ref={refCallback}
      className="fixed z-[9999]"
      style={{ left: state.position.x, top: state.position.y }}
    >
      <MenuList items={state.items} onClose={onClose} />
    </div>,
    document.body,
  );
}

function MenuList({
  items,
  onClose,
  className,
}: {
  items: ContextMenuItem[];
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-[192px] overflow-visible rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 text-popover-foreground shadow-xl shadow-black/8",
        "animate-in fade-in-0 zoom-in-[0.97] slide-in-from-top-1 duration-150",
        className,
      )}
    >
      {items.map((item, idx) =>
        item.id === "separator" ? (
          <div key={`sep-${idx}`} className="-mx-1.5 my-1.5 h-px bg-border/50" />
        ) : item.children?.length ? (
          <SubMenuItem key={item.id} item={item} onClose={onClose} />
        ) : (
          <MenuItem key={item.id} item={item} onClose={onClose} />
        ),
      )}
    </div>
  );
}

function MenuItem({ item, onClose }: { item: ContextMenuItem; onClose: () => void }) {
  return (
    <button
      disabled={item.disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12px] outline-none transition-colors",
        "hover:bg-accent/80 focus-visible:bg-accent/80",
        item.disabled && "pointer-events-none opacity-40",
        item.danger
          ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
          : "text-foreground/85",
      )}
      onClick={() => {
        item.onClick?.();
        onClose();
      }}
    >
      {item.icon && (
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center shrink-0",
            item.danger ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {item.icon}
        </span>
      )}
      <span className="flex-1 text-left font-medium">{item.label}</span>
      {item.shortcut && (
        <kbd className="ml-auto text-[10px] tracking-wide text-muted-foreground/50 font-mono">
          {item.shortcut}
        </kbd>
      )}
    </button>
  );
}

function SubMenuItem({ item, onClose }: { item: ContextMenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancelCloseTimer = () => {
    if (closeTimerRef.current !== undefined) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  };

  const openSubMenu = () => {
    cancelCloseTimer();
    if (!item.disabled) setOpen(true);
  };

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        cancelCloseTimer();
        closeTimerRef.current = setTimeout(() => setOpen(false), 220);
      }}
      onMouseEnter={openSubMenu}
    >
      <button
        type="button"
        disabled={item.disabled}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12px] outline-none transition-colors",
          "hover:bg-accent/80 focus-visible:bg-accent/80",
          item.disabled && "pointer-events-none opacity-40",
          "text-foreground/85",
        )}
        aria-expanded={open}
        onMouseEnter={openSubMenu}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cancelCloseTimer();
          setOpen((v) => !v);
        }}
      >
        {item.icon && (
          <span className="flex h-4 w-4 items-center justify-center shrink-0 text-muted-foreground">
            {item.icon}
          </span>
        )}
        <span className="flex-1 text-left font-medium">{item.label}</span>
        <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/50" />
      </button>
      {open && item.children && (
        <div
          className="absolute left-full top-0 z-[10000] pl-1 -ml-px min-h-full flex items-start"
          onMouseEnter={openSubMenu}
        >
          <MenuList items={item.children} onClose={onClose} />
        </div>
      )}
    </div>
  );
}
