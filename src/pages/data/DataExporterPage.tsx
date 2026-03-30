import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";

const formats = [
  { id: "csv", icon: FileSpreadsheet, label: "CSV", gradient: "from-emerald-400 to-teal-500" },
  { id: "json", icon: FileJson, label: "JSON", gradient: "from-blue-400 to-indigo-500" },
  { id: "txt", icon: FileText, label: "TXT", gradient: "from-amber-400 to-orange-500" },
] as const;

export function DataExporterPage() {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState("csv");

  return (
    <SubPageLayout
      titleKey="data.exporterTitle"
      descriptionKey="data.exporterDesc"
      icon={Download}
      iconGradient="from-teal-400 to-cyan-500"
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("data.datasetLabel", "选择数据集")}
          </label>
          <Input
            placeholder={t("data.datasetPlaceholder", "输入或选择数据集名称...")}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("data.formatLabel", "导出格式")}
          </label>
          <div className="flex gap-3">
            {formats.map(({ id, icon: Icon, label, gradient }) => (
              <button
                key={id}
                onClick={() => setSelectedFormat(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                  selectedFormat === id
                    ? "border-primary bg-accent/50"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                <div className={`p-1.5 rounded-md bg-gradient-to-br ${gradient} text-white`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button className="gap-1.5">
            <Download className="h-4 w-4" />
            {t("data.exportBtn", "导出")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
