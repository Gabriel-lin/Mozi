// ── 偏好 & 设置 ──────────────────────────────────────────────────────────

export type Theme = "light" | "dark" | "system";
export type Language = "zh" | "en";

export interface UserPreferences {
  theme: Theme;
  language: Language;
  fontSize: number;
  sidebarCollapsed: boolean;
  sidebarHidden: boolean;
}

export interface AppSettings {
  windowWidth: number;
  windowHeight: number;
  windowX: number | null;
  windowY: number | null;
  isMaximized: boolean;
  lastOpenedWorkspace: string | null;
  recentFiles: string[];
  maxRecentFiles: number;
  autoSave: boolean;
  autoSaveInterval: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  language: "zh",
  fontSize: 14,
  sidebarCollapsed: false,
  sidebarHidden: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  windowWidth: 1200,
  windowHeight: 700,
  windowX: null,
  windowY: null,
  isMaximized: false,
  lastOpenedWorkspace: null,
  recentFiles: [],
  maxRecentFiles: 10,
  autoSave: true,
  autoSaveInterval: 30000,
};

// ── 用户资料 ──────────────────────────────────────────────────────────────

export interface UserProfile {
  username: string;
  avatar: string;
  email: string;
  phone: string;
  github: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Workspace {
  id: string;
  name: string;
  type: "local" | "remote";
  path: string;
  isActive: boolean;
}

export interface ProfileSettings {
  user: UserProfile;
  workspaces: Workspace[];
}

export const DEFAULT_PROFILE: UserProfile = {
  username: "",
  avatar: "",
  email: "",
  phone: "",
  github: "",
};

export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: "1",
    name: "本地工作区",
    type: "local",
    path: "/home/gab/projects",
    isActive: true,
  },
  {
    id: "2",
    name: "远程工作区 1",
    type: "remote",
    path: "user@remote-server:/home/user/projects",
    isActive: false,
  },
  {
    id: "3",
    name: "远程工作区 2",
    type: "remote",
    path: "admin@192.168.1.100:/workspace",
    isActive: false,
  },
];

export const DEFAULT_PERMISSIONS: Permission[] = [
  { id: "1", name: "read", description: "读取权限" },
  { id: "2", name: "write", description: "写入权限" },
  { id: "3", name: "delete", description: "删除权限" },
  { id: "4", name: "admin", description: "管理员权限" },
  { id: "5", name: "execute", description: "执行权限" },
];

export const DEFAULT_ROLES: Role[] = [
  { id: "1", name: "admin", permissions: ["1", "2", "3", "4", "5"] },
  { id: "2", name: "developer", permissions: ["1", "2", "5"] },
  { id: "3", name: "viewer", permissions: ["1"] },
];

// ── 鉴权 ────────────────────────────────────────────────────────────────

export type AuthProvider = "github" | "email";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

export interface AuthSession {
  accessToken: string;
  provider: AuthProvider;
  githubUser: GitHubUser | null;
  authenticatedAt: number;
}
