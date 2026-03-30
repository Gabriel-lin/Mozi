import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Network, Save } from "lucide-react";

export function SwarmEditPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="swarm.editTitle"
      descriptionKey="swarm.editDesc"
      icon={Network}
      iconGradient="from-teal-400 to-cyan-500"
      actions={
        <Button size="sm" className="gap-1.5">
          <Save className="h-4 w-4" />
          {t("common.save", "保存")}
        </Button>
      }
    >
      <div className="grid gap-4 max-w-lg">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("swarm.nameLabel", "集群名称")}
          </label>
          <Input defaultValue="My Swarm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("swarm.strategyLabel", "协作策略")}
          </label>
          <Input defaultValue="round-robin" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("swarm.maxRetriesLabel", "最大重试次数")}
          </label>
          <Input type="number" defaultValue="3" />
        </div>
      </div>
    </SubPageLayout>
  );
}
