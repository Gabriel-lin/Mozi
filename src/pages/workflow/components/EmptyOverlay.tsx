import React from "react";
import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";

export function EmptyOverlay() {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4 pointer-events-auto">
        <div className="relative">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 text-white/80 shadow-lg shadow-blue-400/20">
            <GitBranch className="h-7 w-7" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 opacity-15 blur-xl" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-medium text-foreground/70">
            {t("workflow.editorHint", "在此处设计工作流节点和连接")}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {t("workflow.dragHint", "从右侧面板拖拽组件到画布，或双击画布添加节点")}
          </p>
        </div>
      </div>
    </div>
  );
}
