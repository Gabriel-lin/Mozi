import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore, useUserStore } from "@mozi/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Home,
  Bot,
  Factory,
  GitBranch,
  Database,
  Network,
  User,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  EyeOff,
  Eye,
} from "lucide-react";

interface NavItem {
  path: string;
  icon: React.ElementType;
  labelKey: string;
  dividerAfter?: boolean;
}

const mainNav: NavItem[] = [
  { path: "/home", icon: Home, labelKey: "nav.home" },
  { path: "/agent", icon: Bot, labelKey: "nav.agent" },
  { path: "/factory", icon: Factory, labelKey: "nav.factory" },
  { path: "/workflow", icon: GitBranch, labelKey: "nav.workflow" },
  { path: "/swarm", icon: Network, labelKey: "nav.swarm", dividerAfter: true },
  { path: "/data", icon: Database, labelKey: "nav.data" },
  { path: "/auth", icon: Shield, labelKey: "nav.auth", dividerAfter: true },
  { path: "/profile", icon: User, labelKey: "nav.profile" },
];

export function isSubRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length >= 2;
}

const COLLAPSED_W = "w-12";
const EXPANDED_W = "w-48";

export function SideNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const collapsed = useUserStore((s) => s.sidebarCollapsed);
  const hidden = useUserStore((s) => s.sidebarHidden);
  const setSidebarCollapsed = useUserStore((s) => s.setSidebarCollapsed);
  const setSidebarHidden = useUserStore((s) => s.setSidebarHidden);
  const authLogout = useAuthStore((s) => s.logout);
  const resetUserState = useUserStore((s) => s.resetUserState);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);

  const handleLogout = () => {
    authLogout();
    resetUserState();
    navigate("/login");
  };

  const autoHidden = isSubRoute(location.pathname);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => {
      if (mq.matches) {
        setSidebarCollapsed(true);
        setMobileOpen(false);
      }
    };
    if (mq.matches) onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setSidebarCollapsed]);

  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMobileOpen(false);
  }

  if (autoHidden || hidden) return null;

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/home" && location.pathname.startsWith(path + "/"));

  const navContent = (
    <nav className="flex flex-col gap-0.5 px-2">
      {mainNav.map(({ path, icon: Icon, labelKey, dividerAfter }) => (
        <React.Fragment key={path}>
          <button
            onClick={() => handleNav(path)}
            title={collapsed ? t(labelKey) : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive(path)
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              collapsed && !mobileOpen && "justify-center px-0",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {(!collapsed || mobileOpen) && <span className="truncate">{t(labelKey)}</span>}
          </button>
          {dividerAfter && <div className="mx-2 my-1 h-px bg-border/60" />}
        </React.Fragment>
      ))}
    </nav>
  );

  const logoutButton = (
    <div className="px-2 pb-2">
      <div className="mx-2 mb-1 h-px bg-border/60" />
      <Button
        variant="ghost"
        onClick={handleLogout}
        title={collapsed && !mobileOpen ? t("login.logout") : undefined}
        className={cn(
          "w-full gap-3 text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
          collapsed && !mobileOpen ? "justify-center px-0" : "justify-start px-2.5",
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {(!collapsed || mobileOpen) && <span className="truncate">{t("login.logout")}</span>}
      </Button>
    </div>
  );

  return (
    <>
      {/* ── 桌面侧边栏 ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-border/40 bg-muted/30",
          "transition-[width] duration-200 ease-in-out overflow-hidden",
          collapsed ? COLLAPSED_W : EXPANDED_W,
        )}
      >
        <div
          className={cn(
            "flex items-center shrink-0 h-10 px-2",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2.5">
              {t("nav.title")}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            {!collapsed && (
              <button
                onClick={() => setSidebarHidden(true)}
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={t("nav.hide")}
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(!collapsed)}
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title={collapsed ? t("nav.expand") : t("nav.collapse")}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">{navContent}</div>
        {logoutButton}
      </aside>

      {/* ── 移动端顶部导航栏 ── */}
      <div className="flex md:hidden items-center h-10 px-3 border-b border-border/40 bg-muted/30 shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="ml-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("nav.title")}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setSidebarHidden(true)}
          className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={t("nav.hide")}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── 移动端侧抽屉 ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-56 bg-background border-r border-border shadow-xl md:hidden flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between h-10 px-3 border-b border-border/40">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("nav.title")}
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">{navContent}</div>
            {logoutButton}
          </div>
        </>
      )}
    </>
  );
}

export function SideNavShowButton() {
  const { t } = useTranslation();
  const location = useLocation();
  const hidden = useUserStore((s) => s.sidebarHidden);
  const setSidebarHidden = useUserStore((s) => s.setSidebarHidden);

  const autoHidden = isSubRoute(location.pathname);

  if (!hidden || autoHidden) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setSidebarHidden(false)}
      className="fixed bottom-4 left-4 z-30 rounded-full shadow-lg"
      title={t("nav.show")}
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}
