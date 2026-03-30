import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useUserStore } from "@mozi/store";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";

export function LanguageSection() {
  const { t, i18n } = useTranslation();
  const setLanguage = useUserStore((s) => s.setLanguage);

  const switchLang = async (lang: "zh" | "en") => {
    setLanguage(lang);
    await i18n.changeLanguage(lang);
    try {
      await emit("set-language", lang);
    } catch {}
  };

  return (
    <section className="space-y-4 animate-fade-in-up stagger-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Globe className="h-3.5 w-3.5" />
        {t("profile.language")}
      </h3>
      <div className="rounded-2xl glass premium-shadow p-5">
        <div className="flex items-center gap-2">
          <Button
            variant={i18n.language === "zh" ? "default" : "outline"}
            size="sm"
            className="rounded-xl h-9 px-4 transition-all duration-200"
            onClick={() => switchLang("zh")}
          >
            中文
          </Button>
          <Button
            variant={i18n.language === "en" ? "default" : "outline"}
            size="sm"
            className="rounded-xl h-9 px-4 transition-all duration-200"
            onClick={() => switchLang("en")}
          >
            English
          </Button>
        </div>
      </div>
    </section>
  );
}
