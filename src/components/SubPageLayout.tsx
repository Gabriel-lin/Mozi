import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubPageLayoutProps {
  titleKey: string;
  descriptionKey?: string;
  icon?: React.ElementType;
  iconGradient?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SubPageLayout({
  titleKey,
  descriptionKey,
  icon: Icon,
  iconGradient = "from-primary to-primary/60",
  actions,
  children,
  className,
}: SubPageLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className={cn("max-w-5xl mx-auto p-6 md:p-8 space-y-6 animate-fade-in", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {Icon && (
            <div
              className={`shrink-0 p-2 rounded-lg bg-gradient-to-br ${iconGradient} text-white shadow-sm`}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
              {t(titleKey)}
            </h1>
            {descriptionKey && (
              <p className="text-sm text-muted-foreground truncate">{t(descriptionKey)}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
