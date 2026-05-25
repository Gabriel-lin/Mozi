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
    <div
      className={cn(
        "mx-auto flex h-full min-h-0 w-full min-w-0 max-w-5xl flex-col gap-6 p-6 md:p-8 animate-fade-in",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-4">
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
              <p className="min-w-0 max-w-full break-words text-sm text-muted-foreground line-clamp-2">
                {t(descriptionKey)}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
    </div>
  );
}
