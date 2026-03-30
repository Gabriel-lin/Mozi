import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Factory, Bot, GitBranch, Puzzle } from "lucide-react";

const templateTypes = [
  {
    id: "agent",
    icon: Bot,
    labelKey: "factory.tplAgent",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    id: "workflow",
    icon: GitBranch,
    labelKey: "factory.tplWorkflow",
    gradient: "from-sky-400 to-indigo-500",
  },
  {
    id: "plugin",
    icon: Puzzle,
    labelKey: "factory.tplPlugin",
    gradient: "from-amber-400 to-orange-500",
  },
] as const;

export function FactoryCreatePage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("agent");

  return (
    <SubPageLayout
      titleKey="factory.createTitle"
      descriptionKey="factory.createDesc"
      icon={Factory}
      iconGradient="from-violet-400 to-purple-500"
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("factory.nameLabel", "模板名称")}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("factory.namePlaceholder", "输入模板名称...")}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("factory.typeLabel", "模板类型")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {templateTypes.map(({ id, icon: Icon, labelKey, gradient }) => (
              <button
                key={id}
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
                <span className="text-sm font-medium text-foreground">{t(labelKey, id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button disabled={!name.trim()}>{t("common.confirm", "创建")}</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            {t("common.cancel", "取消")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
