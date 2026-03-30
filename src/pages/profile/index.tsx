import { useTranslation } from "react-i18next";
import { UserInfoSection } from "./UserInfoSection";
import { LanguageSection } from "./LanguageSection";
import { GitHubSection } from "./GitHubSection";
import { WorkspaceSection } from "./WorkspaceSection";

export function ProfilePage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.description")}</p>
      </div>

      <UserInfoSection />
      <LanguageSection />
      <GitHubSection />
      <WorkspaceSection />
    </div>
  );
}
