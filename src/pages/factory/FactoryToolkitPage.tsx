import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  Package,
  Download,
  Check,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Globe,
  Cpu,
  Plug,
  PackageMinus,
} from "lucide-react";
import { workspaceApi, type WorkspaceInfo } from "@/services/workspace";
import { toolkitApi, type Toolkit, type ToolkitSource } from "@/services/toolkit";
import { RegisterToolkitDialog } from "./components/RegisterToolkitDialog";

const TOOLKIT_SOURCE_UI: Record<
  ToolkitSource,
  { labelKey: string; icon: typeof Cpu; className: string }
> = {
  builtin: {
    labelKey: "factory.sourceBuiltin",
    icon: Cpu,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  mcp: {
    labelKey: "factory.sourceMcp",
    icon: Globe,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  custom: {
    labelKey: "factory.sourceCustom",
    icon: Plug,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

export function FactoryToolkitPage() {
  const { t } = useTranslation();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [toolkits, setToolkits] = useState<Toolkit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);

  const fetchToolkits = useCallback(
    async (wsId: string) => {
      try {
        setLoading(true);
        setError(null);
        const res = await toolkitApi.list(wsId);
        setToolkits(res?.toolkits ?? []);
      } catch {
        setError(t("factory.toolkitLoadError"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await workspaceApi.list();
        if (cancelled) return;
        const list = res?.workspaces ?? [];
        const activeId = res?.active_workspace_id;
        const active = list.find((w) => w.id === activeId) ?? list[0] ?? null;
        setWorkspace(active);
        if (active) {
          await fetchToolkits(active.id);
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(t("factory.toolkitLoadError"));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchToolkits, t]);

  const handleInstall = async (toolkit: Toolkit) => {
    if (!workspace || installing) return;
    try {
      setInstalling(toolkit.id);
      await toolkitApi.install(workspace.id, toolkit.id);
      setToolkits((prev) =>
        prev.map((tk) => (tk.id === toolkit.id ? { ...tk, installed: true } : tk)),
      );
      toast.success(t("factory.installSuccess", { name: toolkit.name }));
    } catch {
      toast.error(t("factory.installFailed"));
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (toolkit: Toolkit) => {
    if (!workspace || installing) return;
    try {
      setInstalling(toolkit.id);
      await toolkitApi.uninstall(workspace.id, toolkit.id);
      setToolkits((prev) =>
        prev.map((tk) => (tk.id === toolkit.id ? { ...tk, installed: false } : tk)),
      );
      toast.success(t("factory.uninstallSuccess", { name: toolkit.name }));
    } catch {
      toast.error(t("factory.uninstallFailed"));
    } finally {
      setInstalling(null);
    }
  };

  const handleDelete = async (toolkit: Toolkit) => {
    if (toolkit.source === "builtin") return;
    try {
      setInstalling(toolkit.id);
      await toolkitApi.delete(toolkit.id);
      setToolkits((prev) => prev.filter((tk) => tk.id !== toolkit.id));
      toast.success(t("factory.deleteSuccess", { name: toolkit.name }));
    } catch {
      toast.error(t("factory.deleteFailed"));
    } finally {
      setInstalling(null);
    }
  };

  return (
    <>
      <SubPageLayout
        titleKey="factory.toolkitTitle"
        descriptionKey="factory.toolkitDesc"
        icon={Wrench}
        iconGradient="from-amber-400 to-orange-500"
        actions={
          <Button
            size="sm"
            className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
            onClick={() => setRegisterOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("factory.registerTool")}
          </Button>
        }
      >
        {workspace && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
              {workspace.type === "local" ? t("profile.localType") : t("profile.remoteType")}
            </span>
            <span className="truncate">{workspace.name}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => workspace && fetchToolkits(workspace.id)}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : toolkits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("factory.toolkitEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {toolkits.map((tk) => {
              const srcCfg = TOOLKIT_SOURCE_UI[tk.source] ?? TOOLKIT_SOURCE_UI.custom;
              const SrcIcon = srcCfg.icon;
              return (
                <div
                  key={tk.id}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-border transition-colors hover:bg-accent/30"
                >
                  <div className="p-2.5 rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">{tk.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${srcCfg.className}`}
                      >
                        <SrcIcon className="h-2.5 w-2.5" />
                        {t(srcCfg.labelKey)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      v{tk.version}
                      {tk.description && ` · ${tk.description}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {tk.source !== "builtin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={installing === tk.id}
                        onClick={() => handleDelete(tk)}
                        aria-label={t("factory.deleteFromRegistryAria")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )}

                    {tk.installed ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="gap-1.5 text-emerald-600 dark:text-emerald-400 pointer-events-none hover:bg-transparent hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          <span>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {t("factory.installed")}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                          disabled={installing === tk.id || !workspace}
                          onClick={() => handleUninstall(tk)}
                          title={t("factory.uninstallFromWorkspaceHint")}
                        >
                          {installing === tk.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PackageMinus className="h-3.5 w-3.5" />
                          )}
                          {t("factory.uninstall")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={installing === tk.id}
                        onClick={() => handleInstall(tk)}
                      >
                        {installing === tk.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {t("factory.install")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SubPageLayout>

      <RegisterToolkitDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        workspaceId={workspace?.id ?? null}
        onRegistered={(tk) => setToolkits((prev) => [...prev, { ...tk, installed: false }])}
      />
    </>
  );
}
