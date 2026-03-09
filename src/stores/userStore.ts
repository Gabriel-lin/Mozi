import { create } from "zustand";
import {
  UserProfile,
  Workspace,
  Permission,
  Role,
  mockProfileSettings,
  mockPermissions,
  mockRoles,
} from "../types/profile";

interface UserState {
  // User profile data
  profile: UserProfile;
  // User workspaces
  workspaces: Workspace[];
  // User permissions
  permissions: Permission[];
  // User roles
  roles: Role[];
  // Current role ID
  currentRoleId: string;

  // Profile update methods
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateUsername: (username: string) => void;
  updateEmail: (email: string) => void;
  updatePhone: (phone: string) => void;
  updateGithub: (github: string) => void;
  updateAvatar: (avatar: string) => void;

  // Workspace methods
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;

  // Role methods
  setCurrentRole: (roleId: string) => void;

  // Reset to initial state
  resetUserState: () => void;
}

const initialState = {
  profile: mockProfileSettings.user,
  workspaces: mockProfileSettings.workspaces,
  permissions: mockPermissions,
  roles: mockRoles,
  currentRoleId: "1",
};

export const useUserStore = create<UserState>((set) => ({
  ...initialState,

  // Profile update methods
  updateProfile: (updates) =>
    set((state) => ({
      profile: { ...state.profile, ...updates },
    })),

  updateUsername: (username) =>
    set((state) => ({
      profile: { ...state.profile, username },
    })),

  updateEmail: (email) =>
    set((state) => ({
      profile: { ...state.profile, email },
    })),

  updatePhone: (phone) =>
    set((state) => ({
      profile: { ...state.profile, phone },
    })),

  updateGithub: (github) =>
    set((state) => ({
      profile: { ...state.profile, github },
    })),

  updateAvatar: (avatar) =>
    set((state) => ({
      profile: { ...state.profile, avatar },
    })),

  // Workspace methods
  addWorkspace: (workspace) =>
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
    })),

  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === id ? { ...ws, ...updates } : ws
      ),
    })),

  removeWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.filter((ws) => ws.id !== id),
    })),

  setActiveWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        isActive: ws.id === id,
      })),
    })),

  // Role methods
  setCurrentRole: (roleId) =>
    set(() => ({
      currentRoleId: roleId,
    })),

  // Reset to initial state
  resetUserState: () => set(initialState),
}));
