import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus, ArrowLeft, Play, Settings, ChevronRight, CircleDot } from "lucide-react";

export function WorkflowPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("nav.workflow")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("workflow.description", "设计和编排工作流")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
          onClick={() => navigate("/workflow/create")}
        >
          <Plus className="h-4 w-4" />
          {t("workflow.create", "新建工作流")}
        </Button>
      </div>

      <div className="rounded-2xl glass premium-shadow overflow-hidden">
        <div className="group flex items-center gap-4 p-5 hover:bg-accent/30 transition-all duration-200 cursor-pointer">
          <div className="relative">
            <div className="p-3 rounded-xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25">
              <GitBranch className="h-5 w-5" />
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">Sample Workflow</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-400/10 text-blue-500 dark:text-blue-400">
                <CircleDot className="h-2.5 w-2.5" />
                Pipeline
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {t("workflow.sampleDesc", "示例工作流 — 数据处理管道")}
            </p>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => navigate("/workflow/edit")}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5 h-8"
              onClick={() => navigate("/workflow/run")}
            >
              <Play className="h-3.5 w-3.5" />
              {t("workflow.run", "运行")}
            </Button>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200" />
        </div>
      </div>

      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-muted-foreground glass px-4 py-2 rounded-full">
          {t(
            "workflow.tip",
            "使用可视化编辑器拖拽创建工作流，或使用 CLI: npx mozi create workflow",
          )}
        </p>
      </div>
    </div>
  );
}
