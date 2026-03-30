import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Cog, Plus, Settings, Trash2 } from "lucide-react";

const tools = [
  { id: "1", name: "web_search", description: "搜索互联网获取实时信息" },
  { id: "2", name: "code_exec", description: "在沙箱中执行代码片段" },
  { id: "3", name: "file_read", description: "读取本地或远程文件内容" },
];

export function FactoryToolPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="factory.toolTitle"
      descriptionKey="factory.toolDesc"
      icon={Cog}
      iconGradient="from-slate-400 to-zinc-500"
      actions={
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("factory.addTool", "添加工具")}
        </Button>
      }
    >
      <div className="space-y-3">
        {tools.map(({ id, name, description }) => (
          <div
            key={id}
            className="group flex items-center gap-4 p-4 rounded-xl border border-border"
          >
            <div className="p-2.5 rounded-lg bg-muted font-mono text-xs text-muted-foreground">
              fn
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground font-mono">{name}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </SubPageLayout>
  );
}
