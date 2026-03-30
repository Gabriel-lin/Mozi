import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Database,
  HardDrive,
  FileSearch,
  ArrowLeft,
  Upload,
  ArrowRight,
  CircleDot,
} from "lucide-react";

interface DataCard {
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  metaKey?: string;
  actionKey?: string;
  gradient: string;
  shadow: string;
  hoverBg: string;
  path: string;
}

const dataCards: DataCard[] = [
  {
    icon: Database,
    titleKey: "data.datasets",
    descKey: "data.datasetsDesc",
    metaKey: "data.noData",
    gradient: "from-emerald-300 via-emerald-400 to-teal-500",
    shadow: "shadow-emerald-400/25",
    hoverBg: "from-emerald-300/5 to-teal-400/5",
    path: "/data/datasets",
  },
  {
    icon: HardDrive,
    titleKey: "data.storage",
    descKey: "data.storageDesc",
    metaKey: "data.noStorage",
    gradient: "from-violet-300 via-violet-400 to-purple-500",
    shadow: "shadow-violet-400/20",
    hoverBg: "from-violet-300/5 to-purple-400/5",
    path: "/data/storage",
  },
  {
    icon: Upload,
    titleKey: "data.import",
    descKey: "data.importDesc",
    actionKey: "data.importBtn",
    gradient: "from-amber-300 via-amber-400 to-orange-500",
    shadow: "shadow-amber-400/25",
    hoverBg: "from-amber-300/5 to-orange-400/5",
    path: "/data/import",
  },
  {
    icon: FileSearch,
    titleKey: "data.explorer",
    descKey: "data.explorerDesc",
    actionKey: "data.explore",
    gradient: "from-teal-300 via-teal-400 to-cyan-500",
    shadow: "shadow-teal-400/25",
    hoverBg: "from-teal-300/5 to-cyan-400/5",
    path: "/data/exporter",
  },
];

export function DataPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.data")}</h1>
          <p className="text-sm text-muted-foreground">{t("data.description", "数据管理与存储")}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {dataCards.map(
          (
            { icon: Icon, titleKey, descKey, metaKey, actionKey, gradient, shadow, hoverBg, path },
            i,
          ) => (
            <div
              key={titleKey}
              onClick={() => navigate(path)}
              className={`group relative p-6 rounded-2xl glass premium-shadow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer overflow-hidden animate-fade-in-up stagger-${i + 1}`}
            >
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${shadow}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">{t(titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
                </div>
                {metaKey && (
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground">{t(metaKey)}</span>
                  </div>
                )}
                {actionKey && (
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5">
                    {t(actionKey)}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${hoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
