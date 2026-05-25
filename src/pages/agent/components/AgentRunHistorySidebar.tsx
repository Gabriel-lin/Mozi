import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Loader2, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { agentApi, type RunOut } from "@/services/agent";

export type AgentRunHistorySidebarProps = {
  runs: RunOut[];
  loading: boolean;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onNewChat: () => void;
  onRunsChanged?: () => void;
  className?: string;
};

export const AgentRunHistorySidebar: FC<AgentRunHistorySidebarProps> = ({
  runs,
  loading,
  selectedRunId,
  onSelectRun,
  onNewChat,
  onRunsChanged,
  className,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.toLowerCase().startsWith("zh") ? zhCN : enUS;

  const onPin = async (runId: string, pinned: boolean) => {
    try {
      await agentApi.pinRun(runId, pinned);
      toast.success(pinned ? t("agent.runPinSuccess") : t("agent.runUnpinSuccess"));
      onRunsChanged?.();
    } catch {
      toast.error(t("agent.runPinError"));
    }
  };

  const onDelete = async (runId: string) => {
    try {
      await agentApi.deleteRun(runId);
      toast.success(t("agent.runDeleteSuccess"));
      if (selectedRunId === runId) {
        onNewChat();
      }
      onRunsChanged?.();
    } catch {
      toast.error(t("agent.runDeleteError"));
    }
  };

  return (
    <aside
      className={cn(
        "flex w-[min(100%,16rem)] shrink-0 flex-col rounded-xl border border-border/50 bg-muted/20 shadow-sm",
        "min-h-0 sm:w-64",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/40 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-emerald-500/25 bg-emerald-500/[0.06] text-foreground hover:bg-emerald-500/10 hover:text-foreground"
          onClick={onNewChat}
        >
          {t("agent.runNewChat")}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("agent.runHistoryTitle")}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            {t("agent.runHistoryLoading")}
          </div>
        ) : runs.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
            {t("agent.runHistoryEmpty")}
          </p>
        ) : (
          <ul className="space-y-1" role="list">
            {runs.map((r) => {
              const label = (r.goal ?? "").trim() || r.id;
              const preview = label.length > 72 ? `${label.slice(0, 72)}…` : label;
              const active = selectedRunId === r.id;
              const pinned = Boolean(r.pinned_at);
              const statusTone =
                r.status === "completed"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : r.status === "failed"
                    ? "text-destructive"
                    : r.status === "stopped"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground";
              return (
                <li key={r.id} className="group/row relative">
                  <button
                    type="button"
                    onClick={() => onSelectRun(r.id)}
                    className={cn(
                      "w-full rounded-xl border px-2.5 py-2 pr-9 text-left text-xs transition-all",
                      active
                        ? "border-emerald-500/35 bg-emerald-500/12 text-foreground shadow-sm ring-1 ring-emerald-500/20"
                        : "border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span className="flex items-start gap-1.5">
                      {pinned ? (
                        <Pin
                          className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : null}
                      <span className="line-clamp-3 min-w-0 font-medium leading-snug">
                        {preview}
                      </span>
                    </span>
                    <span className="mt-1 block text-[10px] tabular-nums">
                      <span className="text-muted-foreground/90">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale })}
                      </span>
                      <span className="text-muted-foreground/50"> · </span>
                      <span className={cn("font-medium", statusTone)}>{r.status}</span>
                    </span>
                  </button>
                  <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={t("agent.runHistoryActions")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            void onPin(r.id, !pinned);
                          }}
                        >
                          {pinned ? (
                            <>
                              <PinOff className="mr-2 h-3.5 w-3.5" />
                              {t("agent.runUnpin")}
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 h-3.5 w-3.5" />
                              {t("agent.runPin")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDelete(r.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {t("agent.runDelete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
