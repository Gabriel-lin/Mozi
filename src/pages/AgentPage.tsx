import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Plus,
  ArrowLeft,
  Play,
  Settings,
  Zap,
  Clock,
  Cpu,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { agentApi, type AgentOut } from "@/services/agent";
import { workspaceApi } from "@/services/workspace";
import { parseAgentType } from "@/pages/agent/utils";

const TYPE_ICON: Record<string, typeof Zap> = {
  react: Zap,
  chain: Cpu,
  chat: MessageSquare,
};

export function AgentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await workspaceApi.list();
        if (cancelled) return;
        const list = res?.workspaces ?? [];
        const activeId = res?.active_workspace_id;
        const ws = list.find((w) => w.id === activeId) ?? list[0];
        const wsId = ws?.id ?? null;
        setWorkspaceId(wsId);
        if (!wsId) {
          setAgents([]);
          return;
        }
        const out = await agentApi.list(wsId, 1, 100);
        if (cancelled) return;
        setAgents(out?.agents ?? []);
      } catch {
        if (!cancelled) {
          toast.error(t("agent.listError"));
          setAgents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const typeLabelKey = (a: AgentOut) => {
    const kind = parseAgentType(a.config as Record<string, unknown>);
    if (kind === "chain") return "agent.typeChain";
    if (kind === "chat") return "agent.typeChat";
    return "agent.typeReact";
  };

  const subtitle = (a: AgentOut) => {
    if (a.description?.trim()) return a.description;
    if (a.model) return a.model;
    return t("agent.defaultDesc");
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.agent")}</h1>
            <p className="text-sm text-muted-foreground">{t("agent.description")}</p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
          onClick={() => navigate("/agent/create")}
        >
          <Plus className="h-4 w-4" />
          {t("agent.create")}
        </Button>
      </div>

      <div className="rounded-2xl glass premium-shadow overflow-hidden divide-y divide-border/50">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t("agent.listLoading")}</span>
          </div>
        ) : !workspaceId ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("agent.noWorkspace")}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("agent.listEmpty")}
          </div>
        ) : (
          agents.map((a) => {
            const kind = parseAgentType(a.config as Record<string, unknown>);
            const TypeIcon = TYPE_ICON[kind] ?? Zap;
            return (
              <div
                key={a.id}
                className="group flex items-center gap-4 p-5 hover:bg-accent/30 transition-all duration-200"
              >
                <div className="relative shrink-0">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-400/25">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground truncate">{a.name}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <TypeIcon className="h-2.5 w-2.5" />
                      {t(typeLabelKey(a))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">{subtitle(a)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => navigate(`/agent/${a.id}/edit`)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1.5 h-8"
                    onClick={() => navigate(`/agent/${a.id}/run`)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {t("agent.run")}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-muted-foreground glass px-4 py-2 rounded-full">
          {t("agent.tip")}
        </p>
      </div>
    </div>
  );
}
