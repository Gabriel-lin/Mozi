import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "./components/ui/modal";
import { ProfileModal } from "./components/ProfileModal";
import { MenuBar } from "./components/MenuBar";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { mockProfileSettings } from "./types/profile";
import { useTranslation } from "react-i18next";
import { getTheme, Theme as PluginTheme } from "@kuyoonjo/tauri-plugin-appearance";
import { invoke } from "@tauri-apps/api/core";

type Theme = "light" | "dark" | "system";
type Lang = "zh" | "en";

function App() {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [lang, setLang] = useState<Lang>("zh");

  // 将 dark 布尔值直接写入 document
  const applyDark = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // 应用主题到 document
  // 对 "system"，通过 Rust 命令读取操作系统实际偏好，避免受插件强制值干扰
  const applyTheme = async (newTheme: Theme) => {
    if (newTheme === "dark") {
      applyDark(true);
    } else if (newTheme === "light") {
      applyDark(false);
    } else {
      try {
        const isDark = await invoke<boolean>("get_system_dark_mode");
        applyDark(isDark);
      } catch {
        // 降级：使用 CSS 媒体查询（可能因插件强制值不准确）
        applyDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    }
  };

  // 监听系统主题变化（当用户在 OS 层切换深色/浅色时同步更新）
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") applyTheme("system");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // 从插件读取已保存的主题偏好，初始化时与系统保持一致
  useEffect(() => {
    const initTheme = async () => {
      try {
        const saved = await getTheme();
        const mapped: Theme =
          saved === PluginTheme.Dark ? "dark" : saved === PluginTheme.Light ? "light" : "system";
        setTheme(mapped);
        await applyTheme(mapped);
      } catch {
        await applyTheme("system");
      }
    };
    initTheme();
  }, []);

  // F11 全屏切换
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

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    await applyTheme(newTheme);
  };

  return (
    <div className="flex h-screen flex-col w-full">
      <MenuBar
        theme={theme}
        lang={lang}
        onThemeChange={handleThemeChange}
        onLangChange={setLang}
        onAbout={() => setAboutOpen(true)}
        onProfile={() => setProfileOpen(true)}
      />

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 text-sm text-muted-foreground">
          {t("theme.current")}:{" "}
          {theme === "system"
            ? t("theme.system")
            : theme === "dark"
              ? t("theme.dark")
              : t("theme.light")}
        </div>

        {/* 关于模态框 */}
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

        {/* 个人资料模态框 */}
        <ProfileModal
          open={profileOpen}
          onOpenChange={setProfileOpen}
          profile={mockProfileSettings}
        />
      </div>
    </div>
  );
}

export default App;
