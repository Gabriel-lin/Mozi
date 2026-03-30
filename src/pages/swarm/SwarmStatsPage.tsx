import React from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { BarChart3, Cpu, Clock, Zap, Activity } from "lucide-react";

const stats = [
  { icon: Cpu, labelKey: "swarm.totalNodes", value: "3", gradient: "from-blue-400 to-indigo-500" },
  {
    icon: Zap,
    labelKey: "swarm.tasksCompleted",
    value: "0",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    icon: Clock,
    labelKey: "swarm.avgLatency",
    value: "—",
    gradient: "from-amber-400 to-orange-500",
  },
  { icon: Activity, labelKey: "swarm.uptime", value: "—", gradient: "from-rose-400 to-pink-500" },
];

export function SwarmStatsPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout
      titleKey="swarm.statsTitle"
      descriptionKey="swarm.statsDesc"
      icon={BarChart3}
      iconGradient="from-teal-400 to-cyan-500"
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, labelKey, value, gradient }) => (
          <div key={labelKey} className="p-4 rounded-xl border border-border space-y-3">
            <div className={`w-fit p-2 rounded-lg bg-gradient-to-br ${gradient} text-white`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t("swarm.statsEmpty", "暂无运行数据，启动集群后将在此展示统计信息")}
        </p>
      </div>
    </SubPageLayout>
  );
}
