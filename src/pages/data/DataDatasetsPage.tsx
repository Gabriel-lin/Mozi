import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Database, Plus, FileText, Table } from "lucide-react";

const datasets = [
  { id: "1", name: "sample_users.csv", rows: 1200, size: "256 KB", icon: Table },
  { id: "2", name: "logs_2025.json", rows: 45000, size: "12 MB", icon: FileText },
];

export function DataDatasetsPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="data.datasetsTitle"
      descriptionKey="data.datasetsPageDesc"
      icon={Database}
      iconGradient="from-rose-400 to-pink-500"
      actions={
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("data.addDataset", "添加数据集")}
        </Button>
      }
    >
      <div className="space-y-3">
        {datasets.map(({ id, name, rows, size, icon: Icon }) => (
          <div
            key={id}
            className="group flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-accent/30 transition-colors cursor-pointer"
          >
            <div className="p-2.5 rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground font-mono truncate">{name}</h3>
              <p className="text-xs text-muted-foreground">
                {rows.toLocaleString()} {t("data.rows", "行")} · {size}
              </p>
            </div>
          </div>
        ))}

        {datasets.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t("data.noData", "暂无数据集")}
          </div>
        )}
      </div>
    </SubPageLayout>
  );
}
