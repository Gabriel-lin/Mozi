import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FolderUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { agentApi, type AgentSkillCatalogOut, type AgentSkillSourceItem } from "@/services/agent";

type FileWithPath = File & { webkitRelativePath?: string };

const folderInputAttrs = {
  webkitdirectory: "",
  directory: "",
} as React.InputHTMLAttributes<HTMLInputElement>;

function sourcePill(
  t: (k: string) => string,
  s: "mozi" | "agents" | "config",
): { key: string; className: string; text: string } {
  if (s === "mozi") {
    return {
      key: "mozi",
      className: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
      text: t("agent.skillSourceMozi"),
    };
  }
  if (s === "agents") {
    return {
      key: "agents",
      className: "bg-violet-500/12 text-violet-800 dark:text-violet-200",
      text: t("agent.skillSourceAgents"),
    };
  }
  return {
    key: "config",
    className: "bg-amber-500/12 text-amber-900 dark:text-amber-200",
    text: t("agent.skillSourceConfig"),
  };
}

function sameIdSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) {
    if (!s.has(x)) return false;
  }
  return true;
}

type Props = {
  agentId: string;
  skillItems: AgentSkillSourceItem[];
  skillsLoading: boolean;
  /** Count of skills enabled in the agent’s saved `config.skills` on the server. */
  serverEnabledCount: number;
  /** Last saved `config.skills` from the server (for unsaved vs saved state on the “saved” tag). */
  serverSkillIds: string[];
  selectedSkillIds: string[];
  onCatalogUpdate: (out: AgentSkillCatalogOut) => void;
  onToggleSkill: (id: string) => void;
};

type CountVariant = "total" | "saved";

function countTag(
  value: string,
  title: string,
  variant: CountVariant,
  /** When form selection differs from last saved `config.skills` (only affects “saved” look). */
  hasUnsavedSelection: boolean,
) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex min-h-7 min-w-0 max-w-full select-none items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums shadow-sm",
        "transition-[box-shadow,background-color,border-color,opacity] duration-200",
        variant === "total" && [
          "border-sky-500/35 bg-sky-500/[0.12] text-sky-900 dark:text-sky-200",
          "ring-1 ring-sky-500/15 dark:ring-sky-400/20",
        ],
        variant === "saved" && [
          "border-primary/40 bg-primary/12 text-primary",
          "ring-1 ring-primary/15",
          hasUnsavedSelection && "ring-2 ring-amber-500/45",
        ],
      )}
    >
      {value}
    </span>
  );
}

export function AgentSkillConfigBlock({
  agentId,
  skillItems,
  skillsLoading,
  serverEnabledCount,
  serverSkillIds,
  selectedSkillIds,
  onCatalogUpdate,
  onToggleSkill,
}: Props) {
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const { t } = useTranslation();
  const selectedSet = React.useMemo(() => new Set(selectedSkillIds), [selectedSkillIds]);

  const hasUnsavedSelection = React.useMemo(
    () => !sameIdSet(selectedSkillIds, serverSkillIds),
    [selectedSkillIds, serverSkillIds],
  );

  const onFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    e.target.value = "";
    if (!fl?.length || !agentId) return;
    void (async () => {
      setImporting(true);
      const first = fl[0] as FileWithPath;
      const p = (first.webkitRelativePath || first.name) as string;
      const folderName = p.includes("/") ? p.split("/")[0]! : "";
      if (!folderName) {
        setImporting(false);
        toast.error(t("agent.addSkillImportNeedFolder"));
        return;
      }
      const fd = new FormData();
      fd.set("skill_id", folderName);
      for (let i = 0; i < fl.length; i++) {
        const file = fl[i] as FileWithPath;
        const rel = file.webkitRelativePath || file.name;
        fd.append("files", file, rel);
      }
      try {
        const out = await agentApi.importSkillFolder(agentId, fd);
        onCatalogUpdate(out);
        toast.success(t("agent.importSkillSuccess"));
      } catch {
        toast.error(t("agent.importSkillError"));
      } finally {
        setImporting(false);
      }
    })();
  };

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 bg-card/30",
        "shadow-sm shadow-black/5 dark:shadow-black/20",
        "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
      )}
    >
      <CardHeader className="space-y-2 p-4 sm:p-5 sm:pb-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:justify-start sm:gap-3">
            <CardTitle className="shrink-0 text-sm font-semibold text-foreground">
              {t("agent.skillsTitle")}
            </CardTitle>
            {skillsLoading ? (
              <span className="inline-flex max-w-[min(100%,12rem)] items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span className="truncate">{t("agent.skillsLoading")}</span>
              </span>
            ) : null}
          </div>
          <div
            className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end sm:gap-1.5"
            aria-label={t("agent.skillsCountAria")}
          >
            {countTag(
              t("agent.skillsTagTotal", { count: skillItems.length }),
              t("agent.skillsTagTotalTitle"),
              "total",
              false,
            )}
            {countTag(
              t("agent.skillsTagEnabled", { count: serverEnabledCount }),
              t("agent.skillsTagEnabledTitle"),
              "saved",
              hasUnsavedSelection,
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        <div className="space-y-3 border-b border-border/50 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-medium text-foreground">
              {t("agent.addSkillByImportTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              {t("agent.addSkillByImportDesc")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={folderInputRef}
              type="file"
              className="sr-only"
              multiple
              {...folderInputAttrs}
              onChange={onFolderChange}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2 w-fit"
              disabled={importing}
              onClick={() => folderInputRef.current?.click()}
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderUp className="h-3.5 w-3.5" />
              )}
              {t("agent.addSkillByImportButton")}
            </Button>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5">
          <p className="mb-1 text-xs font-medium text-foreground">
            {t("agent.skillSelectionSection")}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">{t("agent.skillsHint")}</p>
          {skillsLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("agent.skillsLoading")}
            </div>
          ) : skillItems.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t("agent.skillsEmpty")}</p>
          ) : (
            <ul className="space-y-2 pr-1" role="list">
              {skillItems.map((item) => {
                const rowId = `agent-skill-${item.id.replace(/[^a-zA-Z0-9_-]/g, (ch) => `u${(ch.codePointAt(0) ?? 0).toString(16)}`)}`;
                const checked = selectedSet.has(item.id);
                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-border/50 bg-background/50 p-3 transition-colors",
                        "hover:border-emerald-500/25 hover:bg-emerald-500/[0.04]",
                        checked && "border-emerald-500/40 bg-emerald-500/[0.06]",
                      )}
                    >
                      <Checkbox
                        id={rowId}
                        checked={checked}
                        onCheckedChange={() => onToggleSkill(item.id)}
                        className="mt-0.5 border-border data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor={rowId}
                          className="block cursor-pointer text-sm font-medium leading-tight text-foreground"
                        >
                          {item.label}
                        </Label>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("agent.skillListItemId", { id: item.id })}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.sources.map((s) => {
                            const pill = sourcePill(t, s);
                            return (
                              <span
                                key={`${item.id}-${pill.key}`}
                                className={cn(
                                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                                  pill.className,
                                )}
                              >
                                {pill.text}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
