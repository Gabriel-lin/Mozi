import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Content } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import {
  Sheet,
  SheetPortal,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NodeConfigForm } from "./NodeConfigForm";
import { EdgeConfigForm } from "./EdgeConfigForm";
import { LLMConfigForm } from "./LLMConfigForm";
import { AgentConfigForm } from "./AgentConfigForm";

interface ConfigDrawerProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  nodes: Node[];
  onClose: () => void;
  onPreviewNode: (id: string, updates: Record<string, unknown>) => void;
  onPreviewEdge: (id: string, updates: Record<string, unknown>) => void;
  onCommit: () => void;
  onRevert: () => void;
  container: HTMLElement | null;
}

export function ConfigDrawer({
  selectedNode,
  selectedEdge,
  nodes,
  onClose,
  onPreviewNode,
  onPreviewEdge,
  onCommit,
  onRevert,
  container,
}: ConfigDrawerProps) {
  const { t } = useTranslation();
  const isOpen = !!(selectedNode || selectedEdge);
  const committedRef = useRef(false);

  const handleConfirm = useCallback(() => {
    committedRef.current = true;
    onCommit();
    onClose();
  }, [onCommit, onClose]);

  const handleClose = useCallback(() => {
    if (!committedRef.current) {
      onRevert();
    }
    committedRef.current = false;
    onClose();
  }, [onRevert, onClose]);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      modal={false}
    >
      <SheetPortal container={container}>
        <Content
          className={cn(
            "absolute inset-y-0 right-0 z-50 flex h-full w-72 flex-col border-l bg-background shadow-lg",
            "transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:duration-300 data-[state=open]:duration-500",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          )}
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <SheetHeader className="p-3 border-b border-border/30 space-y-0">
            <SheetTitle className="text-xs font-semibold uppercase tracking-wider">
              {selectedNode
                ? t("workflow.nodeConfig", "节点配置")
                : t("workflow.edgeConfig", "连线配置")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {selectedNode
                ? t("workflow.nodeConfig", "节点配置")
                : t("workflow.edgeConfig", "连线配置")}
            </SheetDescription>
          </SheetHeader>

          {selectedNode &&
            (() => {
              const kind = (selectedNode.data as Record<string, unknown>)?.nodeKind;
              if (kind === "llm")
                return (
                  <LLMConfigForm
                    key={selectedNode.id}
                    node={selectedNode}
                    onPreview={onPreviewNode}
                    onConfirm={handleConfirm}
                  />
                );
              if (kind === "agent")
                return (
                  <AgentConfigForm
                    key={selectedNode.id}
                    node={selectedNode}
                    nodes={nodes}
                    onPreview={onPreviewNode}
                    onConfirm={handleConfirm}
                  />
                );
              return (
                <NodeConfigForm
                  key={selectedNode.id}
                  node={selectedNode}
                  onPreview={onPreviewNode}
                  onConfirm={handleConfirm}
                />
              );
            })()}

          {selectedEdge && (
            <EdgeConfigForm
              key={selectedEdge.id}
              edge={selectedEdge}
              nodes={nodes}
              onPreview={onPreviewEdge}
              onConfirm={handleConfirm}
            />
          )}

          <SheetClose className="absolute right-3 top-2.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </Content>
      </SheetPortal>
    </Sheet>
  );
}
