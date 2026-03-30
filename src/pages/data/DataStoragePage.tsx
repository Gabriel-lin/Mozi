import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { HardDrive, Plus, Server, CheckCircle, XCircle } from "lucide-react";

const backends = [
  { id: "1", name: "Local SQLite", type: "sqlite", connected: true },
  { id: "2", name: "PostgreSQL (remote)", type: "postgresql", connected: false },
];

export function DataStoragePage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="data.storageTitle"
      descriptionKey="data.storagePageDesc"
      icon={HardDrive}
      iconGradient="from-violet-400 to-purple-500"
      actions={
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("data.addBackend", "添加存储后端")}
        </Button>
      }
    >
      <div className="space-y-3">
        {backends.map(({ id, name, type, connected }) => (
          <div key={id} className="flex items-center gap-4 p-4 rounded-xl border border-border">
            <div className="p-2.5 rounded-lg bg-muted">
              <Server className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{name}</h3>
              <p className="text-xs text-muted-foreground">{type}</p>
            </div>
            {connected ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                {t("data.connected", "已连接")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5" />
                {t("data.disconnected", "未连接")}
              </span>
            )}
          </div>
        ))}
      </div>
    </SubPageLayout>
  );
}
