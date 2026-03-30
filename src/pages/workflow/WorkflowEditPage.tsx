import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { GitBranch, Save, Plus } from "lucide-react";

export function WorkflowEditPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="workflow.editTitle"
      descriptionKey="workflow.editDesc"
      icon={GitBranch}
      iconGradient="from-sky-400 to-indigo-500"
      actions={
        <Button size="sm" className="gap-1.5">
          <Save className="h-4 w-4" />
          {t("common.save", "保存")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("workflow.editorHint", "在此处设计工作流节点和连接")}
          </p>
          <Button variant="outline" className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("workflow.addNode", "添加节点")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
