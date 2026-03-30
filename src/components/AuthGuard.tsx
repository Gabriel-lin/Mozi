import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@mozi/store";
import { Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/login"];

interface AuthGuardProps {
  children: React.ReactNode;
}

function LoadingSplash() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s._hydrated);
  const location = useLocation();

  if (!hydrated) {
    return <LoadingSplash />;
  }

  const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));

  if (!isAuthenticated && !isPublic) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAuthenticated && location.pathname === "/login") {
    const target = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
