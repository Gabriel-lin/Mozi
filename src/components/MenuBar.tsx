import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { Minus, Maximize2, Minimize2, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Theme = "light" | "dark" | "system";
type Lang = "zh" | "en";

interface MenuBarProps {
  theme: Theme;
  lang: Lang;
  onThemeChange: (theme: Theme) => void;
  onLangChange: (lang: Lang) => void;
  onAbout: () => void;
  onProfile: () => void;
}

// 带右对齐快捷键的菜单项
function Item({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between gap-8 py-[3px] text-[13px]"
    >
      <span>{label}</span>
      {shortcut && (
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">{shortcut}</span>
      )}
    </DropdownMenuItem>
  );
}

// 带选中状态的菜单项
function CheckItem({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="flex items-center gap-2 py-[3px] text-[13px]">
      <span className="flex w-4 shrink-0 items-center justify-center">
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

// 顶级菜单触发器
function MenuTrigger({
  label,
  open,
  onOpenChange,
  onHover,
  children,
}: {
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          onMouseEnter={onHover}
          className={cn(
            "flex h-full items-center px-[10px] text-[13px] select-none outline-none",
            "transition-colors duration-100",
            open
              ? "bg-accent text-foreground"
              : "text-foreground/75 hover:bg-accent/50 hover:text-foreground",
          )}
        >
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={1}
        className="min-w-[200px] rounded-[4px] p-[2px] shadow-lg"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuBar({
  theme,
  lang,
  onThemeChange,
  onLangChange,
  onAbout,
  onProfile,
}: MenuBarProps) {
  const { t, i18n } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // 同步全屏状态
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const init = async () => {
      try {
        const win = getCurrentWindow();
        setIsFullscreen(await win.isFullscreen());
        unlisten = await win.onResized(async () => {
          setIsFullscreen(await win.isFullscreen());
        });
      } catch {}
    };
    init();
    return () => unlisten?.();
  }, []);

  const handleTheme = async (newTheme: Theme) => {
    onThemeChange(newTheme);
    try {
      await emit("set-theme", newTheme);
    } catch {}
    setOpenMenu(null);
  };

  const handleLang = async (newLang: Lang) => {
    onLangChange(newLang);
    try {
      await i18n.changeLanguage(newLang);
      await emit("set-language", newLang);
    } catch {}
    setOpenMenu(null);
  };

  const handleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const fs = await win.isFullscreen();
      await win.setFullscreen(!fs);
      setIsFullscreen(!fs);
    } catch {}
    setOpenMenu(null);
  };

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {}
  };
  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch {}
  };

  const execEdit = (cmd: string) => {
    try {
      document.execCommand(cmd);
    } catch {}
    setOpenMenu(null);
  };

  // 受控开关（闭包安全）
  const toggle = (id: string) => (v: boolean) =>
    setOpenMenu((cur) => (v ? id : cur === id ? null : cur));

  // 悬停时若已有菜单打开则切换
  const hover = (id: string) => setOpenMenu((cur) => (cur !== null && cur !== id ? id : cur));

  return (
    <div
      className={cn(
        "flex h-8 w-full shrink-0 items-stretch select-none",
        "border-b border-border/40 bg-muted/50",
      )}
    >
      {/* ── 菜单项 ── */}
      <div className="flex items-stretch">
        {/* 文件 */}
        <MenuTrigger
          label={t("menu.file")}
          open={openMenu === "file"}
          onOpenChange={toggle("file")}
          onHover={() => hover("file")}
        >
          <Item
            label={t("menu.profile")}
            onClick={() => {
              onProfile();
              setOpenMenu(null);
            }}
          />
          <DropdownMenuSeparator className="my-[2px]" />

          {/* 主题子菜单 — 单层 */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="py-[3px] text-[13px]">
              {t("menu.theme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[160px] rounded-[4px] p-[2px] shadow-lg">
              <CheckItem
                label={t("menu.darkTheme")}
                checked={theme === "dark"}
                onClick={() => handleTheme("dark")}
              />
              <CheckItem
                label={t("menu.lightTheme")}
                checked={theme === "light"}
                onClick={() => handleTheme("light")}
              />
              <CheckItem
                label={t("menu.systemTheme")}
                checked={theme === "system"}
                onClick={() => handleTheme("system")}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* 语言子菜单 — 单层 */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="py-[3px] text-[13px]">
              {t("menu.language")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[120px] rounded-[4px] p-[2px] shadow-lg">
              <CheckItem label="中文" checked={lang === "zh"} onClick={() => handleLang("zh")} />
              <CheckItem label="English" checked={lang === "en"} onClick={() => handleLang("en")} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator className="my-[2px]" />
          <Item
            label={t("menu.quit")}
            shortcut="Ctrl+Q"
            onClick={async () => {
              setOpenMenu(null);
              try {
                await getCurrentWindow().close();
              } catch {}
            }}
          />
        </MenuTrigger>

        {/* 编辑 */}
        <MenuTrigger
          label={t("menu.edit")}
          open={openMenu === "edit"}
          onOpenChange={toggle("edit")}
          onHover={() => hover("edit")}
        >
          <Item label={t("menu.undo")} shortcut="Ctrl+Z" onClick={() => execEdit("undo")} />
          <Item label={t("menu.redo")} shortcut="Ctrl+Y" onClick={() => execEdit("redo")} />
          <DropdownMenuSeparator className="my-[2px]" />
          <Item label={t("menu.cut")} shortcut="Ctrl+X" onClick={() => execEdit("cut")} />
          <Item label={t("menu.copy")} shortcut="Ctrl+C" onClick={() => execEdit("copy")} />
          <Item label={t("menu.paste")} shortcut="Ctrl+V" onClick={() => execEdit("paste")} />
          <DropdownMenuSeparator className="my-[2px]" />
          <Item
            label={t("menu.selectAll")}
            shortcut="Ctrl+A"
            onClick={() => execEdit("selectAll")}
          />
        </MenuTrigger>

        {/* 视图 */}
        <MenuTrigger
          label={t("menu.view")}
          open={openMenu === "view"}
          onOpenChange={toggle("view")}
          onHover={() => hover("view")}
        >
          <Item
            label={t("menu.reload")}
            shortcut="Ctrl+R"
            onClick={() => {
              setOpenMenu(null);
              window.location.reload();
            }}
          />
          <Item
            label={isFullscreen ? t("menu.exitFullscreen") : t("menu.fullscreen")}
            shortcut="F11"
            onClick={handleFullscreen}
          />
        </MenuTrigger>

        {/* 帮助 */}
        <MenuTrigger
          label={t("menu.help")}
          open={openMenu === "help"}
          onOpenChange={toggle("help")}
          onHover={() => hover("help")}
        >
          <Item
            label={t("menu.about")}
            onClick={() => {
              onAbout();
              setOpenMenu(null);
            }}
          />
        </MenuTrigger>
      </div>

      {/* ── 拖拽区域 ── */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* ── 窗口控制按钮 ── */}
      <div className="flex items-stretch">
        <button
          onClick={handleMinimize}
          className={cn(
            "flex h-full w-[46px] items-center justify-center",
            "text-foreground/50 transition-colors duration-150",
            "hover:bg-accent hover:text-foreground",
          )}
          title={t("window.minimize")}
        >
          <Minus className="h-[14px] w-[14px]" />
        </button>

        <button
          onClick={handleFullscreen}
          className={cn(
            "flex h-full w-[46px] items-center justify-center",
            "text-foreground/50 transition-colors duration-150",
            "hover:bg-accent hover:text-foreground",
          )}
          title={isFullscreen ? t("menu.exitFullscreen") : t("menu.fullscreen")}
        >
          {isFullscreen ? (
            <Minimize2 className="h-[13px] w-[13px]" />
          ) : (
            <Maximize2 className="h-[13px] w-[13px]" />
          )}
        </button>

        <button
          onClick={handleClose}
          className={cn(
            "flex h-full w-[46px] items-center justify-center",
            "text-foreground/50 transition-colors duration-150",
            "hover:bg-destructive hover:text-white",
          )}
          title={t("window.close")}
        >
          <X className="h-[14px] w-[14px]" />
        </button>
      </div>
    </div>
  );
}
