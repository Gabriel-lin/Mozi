import { useCallback, useMemo, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { NodeRunState } from "../../hooks/useWorkflowRun";
import { ConfigTabPanel } from "./ConfigTabPanel";
import { RunDetailPanel } from "./RunDetailPanel";

export interface ConfigDrawerProps {
  /** Bumps when undo/redo runs so config forms remount from graph state. */
  historyCursor: number;
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  nodes: Node[];
  /** Per-node live run state, keyed by node id. */
  nodeRunStates: Record<string, NodeRunState>;
  onClose: () => void;
  onPreviewNode: (id: string, updates: Record<string, unknown>) => void;
  onPreviewEdge: (id: string, updates: Record<string, unknown>) => void;
  onCommit: () => void;
  onRevert: () => void;
  container: HTMLElement | null;
}

type DrawerTab = "config" | "run";

/**
 * Side drawer for node / edge configuration. Two tabs:
 *   - 配置      → form dispatched by {@link ConfigTabPanel}
 *   - 运行详情  → live run state rendered by {@link RunDetailPanel}
 */
export function ConfigDrawer({
  historyCursor,
  selectedNode,
  selectedEdge,
  nodes,
  nodeRunStates,
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
  const [activeTab, setActiveTab] = useState<DrawerTab>("config");

  // Reset to the config tab whenever a different node/edge is selected.
  // Adjusting state during render (vs. useEffect) avoids a cascading render.
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const selectionKey = selectedNode?.id ?? selectedEdge?.id ?? null;
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey);
  if (prevSelectionKey !== selectionKey) {
    setPrevSelectionKey(selectionKey);
    setActiveTab("config");
  }

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

  const titleText = selectedNode ? t("workflow.nodeTitle") : t("workflow.edgeTitle");

  const nodeRunState = useMemo<NodeRunState | undefined>(() => {
    if (!selectedNode) return undefined;
    return nodeRunStates[selectedNode.id];
  }, [selectedNode, nodeRunStates]);

  const tabs = useMemo(
    () =>
      [
        { value: "config", label: t("workflow.tabConfig") },
        { value: "run", label: t("workflow.tabRunDetail") },
      ] as const,
    [t],
  );

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
            "absolute inset-y-0 right-0 z-50 flex h-full max-w-full flex-col border-l bg-background shadow-lg",
            "w-full max-w-[min(100%,22rem)] sm:max-w-none sm:w-80 md:w-96 lg:w-[26rem] xl:w-[28rem]",
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
              {titleText}
            </SheetTitle>
            <SheetDescription className="sr-only">{titleText}</SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as DrawerTab)}
            className="flex flex-1 min-h-0 flex-col"
          >
            {/*
              Underline-style tab bar: the wrapper draws a bottom divider,
              each trigger draws a 2px bottom border that overlaps the
              divider via -mb-px. Active trigger glows emerald.
            */}
            <div className="border-b border-border/30 px-3">
              <TabsList
                className={cn("h-auto gap-5 rounded-none bg-transparent p-0", "justify-start")}
              >
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "relative -mb-px h-auto rounded-none bg-transparent px-0 py-2.5",
                      "text-xs font-medium text-muted-foreground shadow-none",
                      "border-b-2 border-transparent transition-colors duration-150",
                      "hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
                      "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                      "data-[state=active]:text-emerald-600",
                      "dark:data-[state=active]:text-emerald-400",
                      "data-[state=active]:border-emerald-500",
                    )}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/*
              Each TabsContent owns the full remaining height. The config
              form keeps its own overflow-y-auto + SheetFooter, so we just
              let it fill the flex column. `mt-0` cancels shadcn's default
              `mt-2`.
            */}
            <TabsContent
              value="config"
              className="mt-0 flex flex-1 min-h-0 flex-col focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <ConfigTabPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                nodes={nodes}
                historyCursor={historyCursor}
                onPreviewNode={onPreviewNode}
                onPreviewEdge={onPreviewEdge}
                onConfirm={handleConfirm}
              />
            </TabsContent>
            <TabsContent
              value="run"
              className="mt-0 flex flex-1 min-h-0 flex-col focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <RunDetailPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                runState={nodeRunState}
              />
            </TabsContent>
          </Tabs>

          <SheetClose className="absolute right-3 top-2.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </Content>
      </SheetPortal>
    </Sheet>
  );
}
