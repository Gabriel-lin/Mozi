import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Save } from "lucide-react";

export function AgentEditPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="agent.editTitle"
      descriptionKey="agent.editDesc"
      icon={Bot}
      iconGradient="from-emerald-400 to-teal-500"
      actions={
        <Button size="sm" className="gap-1.5">
          <Save className="h-4 w-4" />
          {t("common.save", "保存")}
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("agent.nameLabel", "智能体名称")}
            </label>
            <Input defaultValue="Default Agent" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("agent.modelLabel", "模型")}
            </label>
            <Input defaultValue="gpt-4" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("agent.promptLabel", "系统提示词")}
            </label>
            <textarea
              className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue="You are a helpful assistant."
              placeholder={t("agent.promptPlaceholder", "输入系统提示词...")}
            />
          </div>
        </div>
      </div>
    </SubPageLayout>
  );
}
