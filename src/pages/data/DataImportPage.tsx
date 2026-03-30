import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, File, Link, Database } from "lucide-react";

const importSources = [
  { id: "file", icon: File, labelKey: "data.importFile", gradient: "from-blue-400 to-indigo-500" },
  { id: "url", icon: Link, labelKey: "data.importUrl", gradient: "from-emerald-400 to-teal-500" },
  { id: "db", icon: Database, labelKey: "data.importDb", gradient: "from-amber-400 to-orange-500" },
] as const;

export function DataImportPage() {
  const { t } = useTranslation();
  const [selectedSource, setSelectedSource] = useState("file");

  return (
    <SubPageLayout
      titleKey="data.importTitle"
      descriptionKey="data.importPageDesc"
      icon={Upload}
      iconGradient="from-amber-400 to-orange-500"
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("data.sourceLabel", "数据来源")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {importSources.map(({ id, icon: Icon, labelKey, gradient }) => (
              <button
                key={id}
                onClick={() => setSelectedSource(id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedSource === id
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

        {selectedSource === "file" && (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("data.dropHint", "拖放文件到此处，或点击选择")}
            </p>
            <Button variant="outline">{t("data.selectFile", "选择文件")}</Button>
          </div>
        )}

        {selectedSource === "url" && (
          <div className="space-y-2 max-w-lg">
            <label className="text-sm font-medium text-foreground">URL</label>
            <Input placeholder="https://example.com/data.csv" />
            <Button className="mt-2">{t("data.fetch", "获取")}</Button>
          </div>
        )}

        {selectedSource === "db" && (
          <div className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("data.connString", "连接字符串")}
              </label>
              <Input placeholder="postgresql://user:pass@host:5432/db" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("data.query", "查询")}
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="SELECT * FROM table LIMIT 100"
              />
            </div>
            <Button>{t("data.execute", "执行")}</Button>
          </div>
        )}
      </div>
    </SubPageLayout>
  );
}
