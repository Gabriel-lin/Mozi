import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Sparkles, Cpu, MessageSquare, Loader2 } from "lucide-react";
import { agentApi } from "@/services/agent";
import { workspaceApi } from "@/services/workspace";

const agentTypes = [
  {
    id: "react",
    icon: Sparkles,
    labelKey: "agent.typeReact",
    gradient: "from-emerald-400 to-teal-500",
  },
  { id: "chain", icon: Cpu, labelKey: "agent.typeChain", gradient: "from-blue-400 to-indigo-500" },
  {
    id: "chat",
    icon: MessageSquare,
    labelKey: "agent.typeChat",
    gradient: "from-violet-400 to-purple-500",
  },
] as const;

export function AgentCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("react");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        const res = await workspaceApi.list();
        if (cancelled) return;
        const list = res?.workspaces ?? [];
        const activeId = res?.active_workspace_id;
        const ws = list.find((w) => w.id === activeId) ?? list[0];
        setWorkspaceId(ws?.id ?? null);
      } catch {
        if (!cancelled) setWorkspaceId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !workspaceId || submitting) return;
    setSubmitting(true);
    try {
      const created = await agentApi.create({
        name: name.trim(),
        workspace_id: workspaceId,
        config: { agent_type: selectedType },
        tags: [],
        max_steps: 10,
      });
      toast.success(t("agent.createSuccess"));
      navigate(`/agent/${created.id}/edit`);
    } catch {
      toast.error(t("agent.createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SubPageLayout
      titleKey="agent.createTitle"
      descriptionKey="agent.createDesc"
      icon={Bot}
      iconGradient="from-emerald-400 to-teal-500"
    >
      <div className="space-y-6">
        {!workspaceId && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{t("agent.noWorkspace")}</p>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("agent.nameLabel")}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("agent.namePlaceholder")}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("agent.typeLabel")}</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {agentTypes.map(({ id, icon: Icon, labelKey, gradient }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedType(id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedType === id
                    ? "border-primary bg-accent/50"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-foreground">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            disabled={!name.trim() || !workspaceId || submitting}
            className="gap-2"
            onClick={() => void handleCreate()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
            {t("agent.createSubmit")}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
