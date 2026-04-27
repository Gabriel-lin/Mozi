import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Boxes, Wrench, ArrowRight, Layers, Network } from "lucide-react";

export function FactoryPage() {
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
              {t("nav.factory")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("factory.description", "组件工厂 — 批量构建和管理组件")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
          onClick={() => navigate("/factory/create")}
        >
          <Plus className="h-4 w-4" />
          {t("factory.create", "新建模板")}
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <div
          onClick={() => navigate("/factory/template")}
          className="group relative p-6 rounded-2xl glass premium-shadow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer overflow-hidden"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-400/25">
                <Boxes className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">{t("factory.templates", "模板库")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("factory.templatesDesc", "预置的智能体和工作流模板")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-muted-foreground">
                {t("factory.builtIn", "3 个内置模板")}
              </span>
            </div>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-300/5 to-teal-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div
          onClick={() => navigate("/factory/toolkit")}
          className="group relative p-6 rounded-2xl glass premium-shadow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer overflow-hidden"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-white shadow-lg shadow-amber-400/25">
                <Wrench className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">{t("factory.tools", "工具集")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("factory.toolsDesc", "可用的工具和插件管理")}
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5 mt-1">
              {t("factory.browse", "浏览")}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-300/5 to-orange-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div
          onClick={() => navigate("/factory/mcp")}
          className="group relative p-6 rounded-2xl glass premium-shadow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer overflow-hidden md:col-span-2 xl:col-span-1"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                <Network className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">{t("factory.mcpCardTitle")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("factory.mcpCardDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Network className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-muted-foreground">
                {t("factory.mcpCardHint")}
              </span>
            </div>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </div>
    </div>
  );
}
