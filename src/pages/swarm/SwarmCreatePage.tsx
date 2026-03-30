import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Network } from "lucide-react";

export function SwarmCreatePage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [nodeCount, setNodeCount] = useState("3");

  return (
    <SubPageLayout
      titleKey="swarm.createTitle"
      descriptionKey="swarm.createDesc"
      icon={Network}
      iconGradient="from-teal-400 to-cyan-500"
    >
      <div className="space-y-6">
        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("swarm.nameLabel", "集群名称")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("swarm.namePlaceholder", "输入集群名称...")}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("swarm.nodeCountLabel", "节点数量")}
            </label>
            <Input
              type="number"
              min="1"
              max="100"
              value={nodeCount}
              onChange={(e) => setNodeCount(e.target.value)}
            />
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
