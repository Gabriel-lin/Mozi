import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Wrench, Package, Download, Check } from "lucide-react";

const toolkits = [
  { id: "1", name: "Web Search", version: "1.2.0", installed: true },
  { id: "2", name: "Code Executor", version: "0.9.1", installed: true },
  { id: "3", name: "File Manager", version: "1.0.0", installed: false },
  { id: "4", name: "API Caller", version: "2.1.0", installed: false },
];

export function FactoryToolkitPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="factory.toolkitTitle"
      descriptionKey="factory.toolkitDesc"
      icon={Wrench}
      iconGradient="from-amber-400 to-orange-500"
    >
      <div className="space-y-3">
        {toolkits.map(({ id, name, version, installed }) => (
          <div key={id} className="flex items-center gap-4 p-4 rounded-xl border border-border">
            <div className="p-2.5 rounded-lg bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{name}</h3>
              <p className="text-xs text-muted-foreground">v{version}</p>
            </div>
            {installed ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {t("factory.installed", "已安装")}
              </span>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                {t("factory.install", "安装")}
              </Button>
            )}
          </div>
        ))}
      </div>
    </SubPageLayout>
  );
}
