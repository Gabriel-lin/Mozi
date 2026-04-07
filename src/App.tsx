import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "./components/ui/modal";
import { MenuBar } from "./components/MenuBar";
import { SideNav, SideNavShowButton } from "./components/SideNav";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useUserStore, type Theme } from "@mozi/store";
import {
  HomePage,
  ProfilePage,
  AuthPage,
  DataPage,
  AgentPage,
  FactoryPage,
  WorkflowPage,
  SwarmPage,
  LoginPage,
  AgentCreatePage,
  AgentEditPage,
  AgentRunPage,
  FactoryCreatePage,
  FactoryTemplatePage,
  FactoryToolkitPage,
  FactoryToolPage,
  WorkflowCreatePage,
  WorkflowEditPage,
  WorkflowRunPage,
  SwarmCreatePage,
  SwarmEditPage,
  SwarmRunPage,
  SwarmStatsPage,
  DataDatasetsPage,
  DataStoragePage,
  DataImportPage,
  DataExporterPage,
} from "./pages";

function App() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [aboutOpen, setAboutOpen] = useState(false);

  const theme = useUserStore((s) => s.theme);
  const language = useUserStore((s) => s.language);
  const setTheme = useUserStore((s) => s.setTheme);
  const setLanguage = useUserStore((s) => s.setLanguage);

  const applyDark = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (theme === "dark") {
      applyDark(true);
    } else if (theme === "light") {
      applyDark(false);
    } else {
      (async () => {
        try {
          const isDark = await invoke<boolean>("get_system_dark_mode");
          if (!cancelled) applyDark(isDark);
        } catch {
          if (!cancelled) applyDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
        }
      })();
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (!cancelled && theme === "system") {
        (async () => {
          try {
            const isDark = await invoke<boolean>("get_system_dark_mode");
            if (!cancelled) applyDark(isDark);
          } catch {
            if (!cancelled) applyDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
          }
        })();
      }
    };
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      cancelled = true;
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        try {
          const win = getCurrentWindow();
          const isFullscreen = await win.isFullscreen();
          await win.setFullscreen(!isFullscreen);
        } catch {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const isLoginPage = location.pathname === "/login";

  return (
    <div className="flex h-screen flex-col w-full">
      {!isLoginPage && (
        <MenuBar
          theme={theme}
          lang={language}
          onThemeChange={handleThemeChange}
          onLangChange={setLanguage}
          onAbout={() => setAboutOpen(true)}
          onProfile={() => navigate("/profile")}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {!isLoginPage && <SideNav />}

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Agent */}
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/agent/create" element={<AgentCreatePage />} />
            <Route path="/agent/edit" element={<AgentEditPage />} />
            <Route path="/agent/run" element={<AgentRunPage />} />

            {/* Factory */}
            <Route path="/factory" element={<FactoryPage />} />
            <Route path="/factory/create" element={<FactoryCreatePage />} />
            <Route path="/factory/template" element={<FactoryTemplatePage />} />
            <Route path="/factory/toolkit" element={<FactoryToolkitPage />} />
            <Route path="/factory/tool" element={<FactoryToolPage />} />

            {/* Workflow */}
            <Route path="/workflow" element={<WorkflowPage />} />
            <Route path="/workflow/create" element={<WorkflowCreatePage />} />
            <Route path="/workflow/edit" element={<WorkflowEditPage />} />
            <Route path="/workflow/:id/edit" element={<WorkflowEditPage />} />
            <Route path="/workflow/run" element={<WorkflowRunPage />} />

            {/* Swarm */}
            <Route path="/swarm" element={<SwarmPage />} />
            <Route path="/swarm/create" element={<SwarmCreatePage />} />
            <Route path="/swarm/edit" element={<SwarmEditPage />} />
            <Route path="/swarm/run" element={<SwarmRunPage />} />
            <Route path="/swarm/stats" element={<SwarmStatsPage />} />

            {/* Data */}
            <Route path="/data" element={<DataPage />} />
            <Route path="/data/datasets" element={<DataDatasetsPage />} />
            <Route path="/data/storage" element={<DataStoragePage />} />
            <Route path="/data/import" element={<DataImportPage />} />
            <Route path="/data/exporter" element={<DataExporterPage />} />

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>

      {!isLoginPage && <SideNavShowButton />}

      <Modal open={aboutOpen} onOpenChange={setAboutOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("about.title")}</ModalTitle>
            <ModalDescription>
              <div className="space-y-2 mt-4">
                <p className="text-base font-medium">{t("about.version")}: 0.1.0</p>
                <p className="text-sm text-muted-foreground">{t("app.description")}</p>
              </div>
            </ModalDescription>
          </ModalHeader>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default App;
