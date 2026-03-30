import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tauriStorage } from "./storage-backend";
import {
  type Theme,
  type Language,
  type UserPreferences,
  type AppSettings,
  type UserProfile,
  type Workspace,
  type Permission,
  type Role,
  DEFAULT_PREFERENCES,
  DEFAULT_SETTINGS,
  DEFAULT_PROFILE,
  DEFAULT_WORKSPACES,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
} from "./types";

// ── State 接口 ────────────────────────────────────────────────────────────

interface UserState
  extends UserPreferences,
    AppSettings {
  profile: UserProfile;
  workspaces: Workspace[];
  permissions: Permission[];
  roles: Role[];
  currentRoleId: string;

  // ── 偏好 ──────────────────────────────────────────────────────────────
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setFontSize: (fontSize: number) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarHidden: (hidden: boolean) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  resetPreferences: () => void;

  // ── 设置 ──────────────────────────────────────────────────────────────
  setWindowBounds: (bounds: {
    width?: number;
    height?: number;
    x?: number | null;
    y?: number | null;
  }) => void;
  setMaximized: (isMaximized: boolean) => void;
  setLastOpenedWorkspace: (path: string | null) => void;
  addRecentFile: (filePath: string) => void;
  removeRecentFile: (filePath: string) => void;
  clearRecentFiles: () => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (ms: number) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // ── 用户资料 ──────────────────────────────────────────────────────────
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateUsername: (username: string) => void;
  updateEmail: (email: string) => void;
  updatePhone: (phone: string) => void;
  updateGithub: (github: string) => void;
  updateAvatar: (avatar: string) => void;

  // ── 工作区 ────────────────────────────────────────────────────────────
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;

  // ── 角色 ──────────────────────────────────────────────────────────────
  setCurrentRole: (roleId: string) => void;

  // ── 重置 ──────────────────────────────────────────────────────────────
  resetUserState: () => void;
}

const initialState = {
  ...DEFAULT_PREFERENCES,
  ...DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE,
  workspaces: DEFAULT_WORKSPACES,
  permissions: DEFAULT_PERMISSIONS,
  roles: DEFAULT_ROLES,
  currentRoleId: "1",
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      // ── 偏好 ────────────────────────────────────────────────────────────
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarHidden: (sidebarHidden) => set({ sidebarHidden }),
      updatePreferences: (partial) => set(partial),
      resetPreferences: () => set(DEFAULT_PREFERENCES),

      // ── 设置 ────────────────────────────────────────────────────────────
      setWindowBounds: (bounds) =>
        set((s) => ({
          windowWidth: bounds.width ?? s.windowWidth,
          windowHeight: bounds.height ?? s.windowHeight,
          windowX: bounds.x !== undefined ? bounds.x : s.windowX,
          windowY: bounds.y !== undefined ? bounds.y : s.windowY,
        })),
      setMaximized: (isMaximized) => set({ isMaximized }),
      setLastOpenedWorkspace: (lastOpenedWorkspace) =>
        set({ lastOpenedWorkspace }),
      addRecentFile: (filePath) =>
        set((s) => {
          const filtered = s.recentFiles.filter((f) => f !== filePath);
          return {
            recentFiles: [filePath, ...filtered].slice(0, s.maxRecentFiles),
          };
        }),
      removeRecentFile: (filePath) =>
        set((s) => ({
          recentFiles: s.recentFiles.filter((f) => f !== filePath),
        })),
      clearRecentFiles: () => set({ recentFiles: [] }),
      setAutoSave: (autoSave) => set({ autoSave }),
      setAutoSaveInterval: (autoSaveInterval) => set({ autoSaveInterval }),
      updateSettings: (partial) => set(partial),
      resetSettings: () => set(DEFAULT_SETTINGS),

      // ── 用户资料 ────────────────────────────────────────────────────────
      updateProfile: (updates) =>
        set((s) => ({ profile: { ...s.profile, ...updates } })),
      updateUsername: (username) =>
        set((s) => ({ profile: { ...s.profile, username } })),
      updateEmail: (email) =>
        set((s) => ({ profile: { ...s.profile, email } })),
      updatePhone: (phone) =>
        set((s) => ({ profile: { ...s.profile, phone } })),
      updateGithub: (github) =>
        set((s) => ({ profile: { ...s.profile, github } })),
      updateAvatar: (avatar) =>
        set((s) => ({ profile: { ...s.profile, avatar } })),

      // ── 工作区 ──────────────────────────────────────────────────────────
      addWorkspace: (workspace) =>
        set((s) => ({ workspaces: [...s.workspaces, workspace] })),
      updateWorkspace: (id, updates) =>
        set((s) => ({
          workspaces: s.workspaces.map((ws) =>
            ws.id === id ? { ...ws, ...updates } : ws,
          ),
        })),
      removeWorkspace: (id) =>
        set((s) => ({
          workspaces: s.workspaces.filter((ws) => ws.id !== id),
        })),
      setActiveWorkspace: (id) =>
        set((s) => ({
          workspaces: s.workspaces.map((ws) => ({
            ...ws,
            isActive: ws.id === id,
          })),
        })),

      // ── 角色 ────────────────────────────────────────────────────────────
      setCurrentRole: (roleId) => set({ currentRoleId: roleId }),

      // ── 重置 ────────────────────────────────────────────────────────────
      resetUserState: () => set(initialState),
    }),
    {
      name: "mozi-store",
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
