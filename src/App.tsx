import React, { lazy, useEffect, useState } from "react";
import { Calendar } from "./components/ui/calendar";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "./components/ui/modal";
import { ProfileModal } from "./components/ProfileModal";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { mockProfileSettings } from "./types/profile";
import { useTranslation } from "react-i18next";

type Theme = "light" | "dark" | "system";

const DynamicLineChart = lazy(() => import("./cpu/DynamicLineChart"));
const CpuMonitor = lazy(() => import("./cpu/CpuMonitor"));

function App() {
  const { t, i18n } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");

  // 应用主题到 document
  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    if (newTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } else if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // 初始化主题
  useEffect(() => {
    applyTheme(theme);
  }, []);

  useEffect(() => {
    let unlistenAbout: (() => void) | null = null;
    let unlistenProfile: (() => void) | null = null;
    let unlistenTheme: (() => void) | null = null;
    let unlistenLang: (() => void) | null = null;

    const setupEventListeners = async () => {
      try {
        unlistenAbout = await listen<void>("show-about", () => {
          setAboutOpen(true);
        });
        
        unlistenProfile = await listen<void>("show-profile", () => {
          setProfileOpen(true);
        });
        
        unlistenTheme = await listen<string>("set-theme", (event) => {
          const newTheme = event.payload as Theme;
          setTheme(newTheme);
          applyTheme(newTheme);
        });

        // 监听语言变更事件，用于重建菜单
        unlistenLang = await listen<string>("set-language", async (event) => {
          const lang = event.payload;
          await i18n.changeLanguage(lang);
          // 通知后端重建菜单
          await emit("rebuild-menu", lang);
        });
      } catch {
        // 非 Tauri 环境（如浏览器预览），忽略
      }
    };

    setupEventListeners();

    return () => {
      unlistenAbout?.();
      unlistenProfile?.();
      unlistenTheme?.();
      unlistenLang?.();
    };
  }, []);

  // 处理 F11 全屏切换
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        try {
          const win = getCurrentWindow();
          const isFullscreen = await win.isFullscreen();
          await win.setFullscreen(!isFullscreen);
        } catch (err) {
          console.error("Failed to toggle fullscreen:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen overflow-y-auto w-full">
      {/* 当前主题显示 */}
      <div className="p-4 text-sm text-muted-foreground">
        {t("theme.current")}: {theme === "system" ? t("theme.system") : theme === "dark" ? t("theme.dark") : t("theme.light")}
      </div>
      {/* <h1 className="text-red-500 text-2xl font-bold">动态折线图</h1> */}
      {/* <Suspense fallback={<div>Loading...</div>}>
        <DynamicLineChart />
      </Suspense> */}
      {/* 关于模态框 */}
      <Modal open={aboutOpen} onOpenChange={setAboutOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("about.title")}</ModalTitle>
            <ModalDescription>
              <div className="space-y-2 mt-4">
                <p className="text-base font-medium">{t("about.version")}: 0.1.0</p>
                <p className="text-sm text-muted-foreground">
                  {t("app.description")}
                </p>
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
  );
}

export default App;
