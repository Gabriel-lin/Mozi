import React from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ChevronDown, Code2, Landmark, Microscope, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PromptTplKey = "code" | "finance" | "law" | "biology" | "history";

const PROMPT_TEMPLATE_KEYS: PromptTplKey[] = ["code", "finance", "law", "biology", "history"];

const TEMPLATE_ICONS: Record<
  PromptTplKey,
  { Icon: React.ElementType; well: string; ring: string }
> = {
  code: {
    Icon: Code2,
    well: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    ring: "group-hover:ring-sky-500/30",
  },
  finance: {
    Icon: Landmark,
    well: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    ring: "group-hover:ring-amber-500/30",
  },
  law: {
    Icon: Scale,
    well: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
    ring: "group-hover:ring-violet-500/30",
  },
  biology: {
    Icon: Microscope,
    well: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    ring: "group-hover:ring-emerald-500/30",
  },
  history: {
    Icon: BookOpen,
    well: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
    ring: "group-hover:ring-rose-500/30",
  },
};

type Props = {
  prompt: string;
  onPromptChange: (v: string) => void;
  applyTemplate: (key: PromptTplKey) => void;
};

export function AgentSystemPromptBlock({ prompt, onPromptChange, applyTemplate }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(true);

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <Label className="text-sm text-foreground" id="agent-prompt-heading" htmlFor="agent-prompt">
          {t("agent.promptLabel")}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="h-8 gap-1 px-2 text-xs text-muted-foreground"
          aria-expanded={open}
        >
          {open ? t("agent.promptCollapse") : t("agent.promptExpand")}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open ? "rotate-0" : "-rotate-90")}
            aria-hidden
          />
        </Button>
      </div>

      {open ? (
        <div className="space-y-4 min-w-0">
          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-gradient-to-b from-muted/50 to-muted/20 p-4 sm:p-5",
              "shadow-sm shadow-black/5 dark:shadow-black/20",
              "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
            )}
          >
            <div className="mb-3 flex items-center gap-2 border-b border-border/50 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("agent.promptTemplatesTitle")}
                </p>
                <p className="text-xs text-muted-foreground">{t("agent.promptTemplatesHint")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
              {PROMPT_TEMPLATE_KEYS.map((key) => {
                const { Icon, well, ring } = TEMPLATE_ICONS[key];
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    onClick={() => applyTemplate(key)}
                    className={cn(
                      "h-auto min-h-14 w-full min-w-0 flex-row items-stretch justify-start gap-2.5 whitespace-normal rounded-xl border border-border/70 bg-background/90 px-3 py-2.5 text-left font-normal sm:min-h-[3.75rem] sm:gap-3 sm:px-3.5 sm:py-3",
                      "transition-all duration-200",
                      "hover:-translate-y-0.5 hover:border-emerald-500/35 hover:bg-emerald-500/[0.06] hover:shadow-md",
                      ring,
                    )}
                  >
                    <span
                      className={cn(
                        "flex w-10 min-w-10 shrink-0 items-center justify-center self-stretch rounded-lg transition-colors sm:w-11 sm:min-w-11",
                        well,
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center whitespace-normal text-left text-xs font-medium leading-snug text-foreground sm:text-sm sm:leading-tight">
                      {t(`agent.promptTpl.${key}`)}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          <Textarea
            id="agent-prompt"
            className="min-h-[200px] rounded-xl text-sm leading-relaxed"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={t("agent.promptPlaceholder")}
            aria-describedby="agent-prompt-heading"
          />
        </div>
      ) : null}
    </div>
  );
}

export type { PromptTplKey };
