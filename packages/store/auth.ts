import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tauriStorage } from "./storage-backend";
import type { AuthSession, GitHubUser } from "./types";

interface AuthState {
  isAuthenticated: boolean;
  session: AuthSession | null;
  _hydrated: boolean;

  login: (session: AuthSession) => void;
  logout: () => void;
  updateGitHubUser: (user: GitHubUser) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      session: null,
      _hydrated: false,

      login: (session) => set({ isAuthenticated: true, session }),

      logout: () => set({ isAuthenticated: false, session: null }),

      updateGitHubUser: (user) =>
        set((s) => ({
          session: s.session ? { ...s.session, githubUser: user } : null,
        })),

      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "mozi-auth",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
