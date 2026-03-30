import { useMemo, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Github,
  ExternalLink,
  CheckCircle,
  XCircle,
  Unlink,
  LogIn,
  Loader2,
  Check,
  Copy,
} from "lucide-react";
import { useUserStore, useAuthStore } from "@mozi/store";
import { useTranslation } from "react-i18next";
import {
  requestDeviceCode,
  openVerificationPage,
  pollForAccessToken,
} from "@/services/github-oauth";
import { api, ApiError } from "@/services/api";

export function GitHubSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile: storeProfile, updateProfile, updateGithub } = useUserStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isGitHubLinked = useMemo(() => !!storeProfile.github, [storeProfile.github]);

  const [ghFlow, setGhFlow] = useState<
    | { step: "idle" }
    | { step: "polling"; userCode: string; verificationUri: string }
    | { step: "error"; message: string }
  >({ step: "idle" });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleGitHubAuth = useCallback(async () => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const deviceCode = await requestDeviceCode();
      setGhFlow({
        step: "polling",
        userCode: deviceCode.user_code,
        verificationUri: deviceCode.verification_uri,
      });
      await openVerificationPage(deviceCode.verification_uri);

      const accessToken = await pollForAccessToken(
        deviceCode.device_code,
        deviceCode.interval,
        deviceCode.expires_in,
        controller.signal,
      );

      const user = await api.post<{ github_login: string; avatar?: string }>("/auth/github/link", {
        access_token: accessToken,
      });
      updateProfile({ github: user.github_login, avatar: user.avatar || storeProfile.avatar });
      setGhFlow({ step: "idle" });
    } catch (err) {
      if ((err as Error).message === "cancelled") {
        setGhFlow({ step: "idle" });
        return;
      }
      const msg = err instanceof ApiError ? err.code : (err as Error).message;
      setGhFlow({ step: "error", message: msg });
    }
  }, [updateProfile, storeProfile.avatar]);

  const handleCancelGhFlow = () => {
    abortRef.current?.abort();
    setGhFlow({ step: "idle" });
  };

  const handleGitHubUnlink = useCallback(async () => {
    try {
      await api.post("/auth/github/unlink");
      updateGithub("");
    } catch (err) {
      console.error("GitHub unlink failed:", err);
    }
  }, [updateGithub]);

  return (
    <section className="space-y-4 animate-fade-in-up stagger-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Github className="h-3.5 w-3.5" />
        {t("profile.github")}
      </h3>

      <div className="rounded-2xl glass premium-shadow overflow-hidden">
        {isGitHubLinked && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              {storeProfile.avatar ? (
                <img
                  src={storeProfile.avatar}
                  alt={storeProfile.github}
                  className="h-12 w-12 rounded-xl ring-2 ring-emerald-400/30 shadow-lg"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Github className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {storeProfile.username}
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    {t("profile.githubLinked")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">@{storeProfile.github}</p>
                <p className="text-xs text-muted-foreground">{storeProfile.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg gap-1.5 shrink-0 hover:border-destructive/50 hover:text-destructive transition-colors"
                onClick={handleGitHubUnlink}
              >
                <Unlink className="h-3.5 w-3.5" />
                {t("profile.githubDisconnect")}
              </Button>
            </div>
            <a
              href={`https://github.com/${storeProfile.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              https://github.com/{storeProfile.github}
            </a>
          </div>
        )}

        {!isGitHubLinked && isAuthenticated && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Github className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-muted-foreground/50">
                    {t("profile.githubPlaceholderName")}
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground/60">
                    <XCircle className="h-3 w-3" />
                    {t("profile.githubNotConnected")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/40">@———</p>
                <p className="text-xs text-muted-foreground/40">———@———.com</p>
              </div>
              {ghFlow.step === "idle" && (
                <Button
                  size="sm"
                  className="rounded-lg gap-1.5 shrink-0 shadow-lg shadow-primary/20"
                  onClick={handleGitHubAuth}
                >
                  <Github className="h-3.5 w-3.5" />
                  {t("profile.githubAuth")}
                </Button>
              )}
            </div>

            {ghFlow.step === "polling" && (
              <div className="p-4 rounded-xl border border-border bg-accent/30 space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  {t("login.deviceFlowHint")}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-lg font-mono font-bold tracking-[0.2em] text-foreground bg-background px-4 py-1.5 rounded-lg">
                    {ghFlow.userCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopyCode(ghFlow.userCode)}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={() => openVerificationPage(ghFlow.verificationUri)}
                >
                  {ghFlow.verificationUri}
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("login.waitingAuth")}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg"
                  onClick={handleCancelGhFlow}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            )}

            {ghFlow.step === "error" && (
              <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-2">
                <p className="text-xs text-destructive">{ghFlow.message}</p>
                <Button variant="outline" size="sm" onClick={() => setGhFlow({ step: "idle" })}>
                  {t("login.retry")}
                </Button>
              </div>
            )}
          </div>
        )}

        {!isAuthenticated && (
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Github className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-muted-foreground/50">
                    {t("profile.githubPlaceholderName")}
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground/60">
                    <XCircle className="h-3 w-3" />
                    {t("profile.githubNotConnected")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/40">@———</p>
                <p className="text-xs text-muted-foreground/40">———@———.com</p>
              </div>
              <Button
                size="sm"
                className="rounded-lg gap-1.5 shadow-lg shadow-primary/20"
                onClick={() => navigate("/login")}
              >
                <LogIn className="h-3.5 w-3.5" />
                {t("profile.goToLogin")}
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground px-1">{t("profile.githubAuthTip")}</p>
    </section>
  );
}
