import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Boxes, Bot, GitBranch, Puzzle, ArrowRight } from "lucide-react";

const templates = [
  {
    id: "1",
    name: "ReAct Agent",
    type: "agent",
    icon: Bot,
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    id: "2",
    name: "Data Pipeline",
    type: "workflow",
    icon: GitBranch,
    gradient: "from-sky-400 to-indigo-500",
  },
  {
    id: "3",
    name: "Search Plugin",
    type: "plugin",
    icon: Puzzle,
    gradient: "from-amber-400 to-orange-500",
  },
];

export function FactoryTemplatePage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="factory.templatesTitle"
      descriptionKey="factory.templatesDesc"
      icon={Boxes}
      iconGradient="from-violet-400 to-purple-500"
    >
      <div className="space-y-3">
        {templates.map(({ id, name, type, icon: Icon, gradient }) => (
          <div
            key={id}
            className="group flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-accent/30 transition-all duration-200 cursor-pointer"
          >
            <div className={`p-2.5 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-sm`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{name}</h3>
              <p className="text-xs text-muted-foreground capitalize">{type}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {t("factory.use", "使用")}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </SubPageLayout>
  );
}
