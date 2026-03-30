import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Shield, Key, Fingerprint, ArrowLeft, ChevronRight } from "lucide-react";

interface AuthItem {
  icon: React.ElementType;
  titleKey: string;
  title?: string;
  descKey: string;
  gradient: string;
  shadow: string;
}

const authItems: AuthItem[] = [
  {
    icon: Key,
    titleKey: "auth.apiKeysTitle",
    title: "API Keys",
    descKey: "auth.apiKeysDesc",
    gradient: "from-emerald-300 via-emerald-400 to-teal-500",
    shadow: "shadow-emerald-400/25",
  },
  {
    icon: Shield,
    titleKey: "auth.permissions",
    descKey: "auth.permissionsDesc",
    gradient: "from-amber-300 via-amber-400 to-orange-500",
    shadow: "shadow-amber-400/25",
  },
  {
    icon: Fingerprint,
    titleKey: "auth.oauth",
    descKey: "auth.oauthDesc",
    gradient: "from-sky-300 via-blue-400 to-indigo-500",
    shadow: "shadow-blue-400/25",
  },
];

export function AuthPage() {
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.auth")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.description", "管理认证与授权配置")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {authItems.map(({ icon: Icon, titleKey, title, descKey, gradient, shadow }, i) => (
          <div
            key={titleKey}
            className={`group relative rounded-2xl glass premium-shadow overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer animate-fade-in-up stagger-${i + 1}`}
          >
            <div className="flex items-center gap-5 p-5">
              <div
                className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${shadow} shrink-0`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">{title || t(titleKey)}</h3>
                <p className="text-xs text-muted-foreground">{t(descKey)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  {t("auth.manage", "管理")}
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
