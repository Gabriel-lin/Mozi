import React from "react";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomBarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function BottomBar({ canUndo, canRedo, onUndo, onRedo }: BottomBarProps) {
  return (
    <div className="flex gap-1 p-1.5 rounded-xl glass border border-border/50 shadow-lg w-fit">
      <UndoBtn disabled={!canUndo} onClick={onUndo} title="撤销">
        <Undo2 className="h-4 w-4" />
      </UndoBtn>
      <UndoBtn disabled={!canRedo} onClick={onRedo} title="恢复">
        <Redo2 className="h-4 w-4" />
      </UndoBtn>
    </div>
  );
}

function UndoBtn({
  disabled,
  onClick,
  title,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150",
        disabled
          ? "text-muted-foreground/30 cursor-default"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}
