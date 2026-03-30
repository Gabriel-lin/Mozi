import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Network, Plus, ArrowLeft, Activity, Cpu } from "lucide-react";

export function SwarmPage() {
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.swarm")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("swarm.description", "多智能体协作集群管理")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
          onClick={() => navigate("/swarm/create")}
        >
          <Plus className="h-4 w-4" />
          {t("swarm.create", "新建集群")}
        </Button>
      </div>

      <div className="relative rounded-2xl glass premium-shadow p-10 md:p-14 text-center space-y-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-teal-300/8 via-emerald-300/6 to-cyan-300/4 blur-2xl" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="mx-auto w-fit animate-float">
            <div className="relative">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-300 via-teal-400 to-cyan-500 text-white shadow-xl shadow-teal-400/30">
                <Network className="h-8 w-8" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-muted-foreground/30 animate-pulse-soft" />
              <div
                className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-muted-foreground/20 animate-pulse-soft"
                style={{ animationDelay: "0.5s" }}
              />
            </div>
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-foreground">
              {t("swarm.empty", "暂无活跃集群")}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(
                "swarm.emptyDesc",
                "Swarm 允许多个智能体协同工作，共同完成复杂任务。创建一个集群开始使用。",
              )}
            </p>
          </div>
          <Button
            className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-10 px-5"
            onClick={() => navigate("/swarm/create")}
          >
            <Plus className="h-4 w-4" />
            {t("swarm.createFirst", "创建第一个集群")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl glass premium-shadow">
        <div className="p-2 rounded-lg bg-muted">
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("swarm.status", "集群状态: 无活跃节点")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/50">0 nodes</span>
        </div>
      </div>
    </div>
  );
}
