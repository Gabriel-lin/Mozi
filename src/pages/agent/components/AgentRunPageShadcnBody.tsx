import type { FC, ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Menu, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { RunOut } from "@/services/agent";
import { AgentRunHistorySidebar } from "@/pages/agent/components/AgentRunHistorySidebar";

export type AgentRunPageShadcnBodyProps = {
  runs: RunOut[];
  loading: boolean;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onNewChat: () => void;
  onRunsChanged?: () => void;
  agentName: string | null;
  children: ReactNode;
};

const SIDEBAR_W = "w-[260px]";

const embeddedHistorySidebarClassName = cn(
  "h-full min-h-0 w-full shrink-0 rounded-none border-0 bg-transparent shadow-none sm:w-full",
);

/**
 * 运行页主体布局，结构参考 assistant-ui 文档中的 shadcn 示例：
 * https://github.com/assistant-ui/assistant-ui/blob/main/apps/docs/components/examples/shadcn.tsx
 * 侧栏为项目内的运行历史；主区域由 `children`（通常为带 AssistantRuntimeProvider 的会话）填充。
 */
export const AgentRunPageShadcnBody: FC<AgentRunPageShadcnBodyProps> = ({
  runs,
  loading,
  selectedRunId,
  onSelectRun,
  onNewChat,
  onRunsChanged,
  agentName,
  children,
}) => {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const historyProps = {
    runs,
    loading,
    selectedRunId,
    onSelectRun,
    onNewChat,
    onRunsChanged,
  };

  const logoRow = (
    <div className="flex min-w-0 items-center gap-2 px-2 text-sm font-medium">
      <Bot className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <span className="truncate text-foreground/90">
        {agentName?.trim() || t("agent.runTitle")}
      </span>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 bg-muted/30">
      <div className="hidden md:block">
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden transition-all duration-200",
            sidebarCollapsed ? "w-0 opacity-0" : cn(SIDEBAR_W, "opacity-100"),
          )}
        >
          <div className={cn("flex h-full shrink-0 flex-col", SIDEBAR_W)}>
            <div className="flex h-14 shrink-0 items-center px-4">{logoRow}</div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              <AgentRunHistorySidebar {...historyProps} className={embeddedHistorySidebarClassName} />
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 transition-[padding] duration-200 md:p-2",
          !sidebarCollapsed && "md:pl-0",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 md:hidden"
                  aria-label={t("agent.runLayoutToggleHistory")}
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex h-full w-[min(100vw,280px)] flex-col gap-0 p-0 sm:max-w-[280px]"
              >
                <div className="flex h-14 shrink-0 items-center border-b border-border/60 px-4">
                  {logoRow}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden p-3">
                  <AgentRunHistorySidebar
                    {...historyProps}
                    className={embeddedHistorySidebarClassName}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("hidden size-9 shrink-0 md:inline-flex")}
              aria-label={
                sidebarCollapsed ? t("agent.runLayoutShowSidebar") : t("agent.runLayoutHideSidebar")
              }
              title={
                sidebarCollapsed ? t("agent.runLayoutShowSidebar") : t("agent.runLayoutHideSidebar")
              }
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <PanelLeft className="size-4" />
            </Button>
          </header>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
};
