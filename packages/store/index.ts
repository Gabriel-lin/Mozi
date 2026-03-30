// ── 类型 ──────────────────────────────────────────────────────────────────
export type {
  Theme,
  Language,
  UserPreferences,
  AppSettings,
  UserProfile,
  Permission,
  Role,
  Workspace,
  ProfileSettings,
  AuthProvider,
  GitHubUser,
  AuthSession,
} from "./types";
export {
  DEFAULT_PREFERENCES,
  DEFAULT_SETTINGS,
  DEFAULT_PROFILE,
  DEFAULT_WORKSPACES,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
} from "./types";

// ── 统一 Store ────────────────────────────────────────────────────────────
export { useUserStore } from "./user";

// ── 鉴权 Store ───────────────────────────────────────────────────────────
export { useAuthStore } from "./auth";

// ── 存储后端 ──────────────────────────────────────────────────────────────
export { tauriStorage, flushStore, resetStoreInstance } from "./storage-backend";
