import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore, useUserStore } from "@mozi/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Github,
  Sparkles,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  LogOut,
  Mail,
  ArrowLeft,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import {
  requestDeviceCode,
  openVerificationPage,
  pollForAccessToken,
  fetchGitHubUser,
} from "@/services/github-oauth";
import { api, ApiError } from "@/services/api";

type PageView = "login" | "register" | "github";

type GitHubFlowState =
  | { step: "idle" }
  | { step: "polling"; userCode: string; verificationUri: string }
  | { step: "error"; message: string };

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const session = useAuthStore((s) => s.session);
  const loginStore = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const resetUserState = useUserStore((s) => s.resetUserState);
  const updateProfile = useUserStore((s) => s.updateProfile);

  const [view, setView] = useState<PageView>("login");
  const [ghFlow, setGhFlow] = useState<GitHubFlowState>({ step: "idle" });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegisterHint, setShowRegisterHint] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/home";

  // 只在异步回调里用到的 "latest value ref"：写入必须放到 useEffect 中，
  // 渲染期间直接赋值会触发 `react-hooks/refs` 报错。
  const navigateRef = useRef(navigate);
  const fromRef = useRef(from);
  useEffect(() => {
    navigateRef.current = navigate;
    fromRef.current = from;
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleLoginSuccess = useCallback(
    (data: {
      token: string;
      user: { name: string; avatar?: string; email: string; github_login?: string };
    }) => {
      updateProfile({
        username: data.user.name,
        avatar: data.user.avatar || "",
        email: data.user.email,
        github: data.user.github_login || "",
      });
      loginStore({
        accessToken: data.token,
        provider: "email",
        githubUser: null,
        authenticatedAt: Date.now(),
      });
      navigateRef.current(fromRef.current, { replace: true });
    },
    [loginStore, updateProfile],
  );

  const handleEmailLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError(t("login.fillRequired"));
      return;
    }
    setLoading(true);
    setError("");
    setShowRegisterHint(false);
    try {
      const data = await api.post<{
        token: string;
        user: { name: string; avatar?: string; email: string; github_login?: string };
      }>("/auth/login", { email: email.trim(), password }, { skipAuth: true });
      handleLoginSuccess(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "user_not_found") {
          setError(t("login.userNotFound"));
          setShowRegisterHint(true);
          return;
        }
        if (err.code === "wrong_password") {
          setError(t("login.wrongPassword"));
          return;
        }
        if (err.code === "account_disabled") {
          setError(t("login.accountDisabled"));
          return;
        }
      }
      if (!error) setError((err as Error).message || t("login.emailError"));
    } finally {
      setLoading(false);
    }
  }, [email, password, t, handleLoginSuccess, error]);

  const handleRegister = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError(t("login.registerFillRequired"));
      return;
    }
    if (password.length < 6) {
      setError(t("login.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("login.passwordMismatch"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{
        token: string;
        user: { name: string; avatar?: string; email: string; github_login?: string };
      }>(
        "/auth/register",
        { email: email.trim(), password, name: name.trim() || undefined },
        { skipAuth: true },
      );
      handleLoginSuccess(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_already_registered") {
        setError(t("login.emailAlreadyRegistered"));
        return;
      }
      if (!error) setError((err as Error).message || t("login.registerError"));
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, name, t, handleLoginSuccess, error]);

  const handleGitHubLogin = useCallback(async () => {
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

      const githubUser = await fetchGitHubUser(accessToken);

      updateProfile({
        github: githubUser.login,
        avatar: githubUser.avatar_url,
        username: githubUser.name || githubUser.login,
        ...(githubUser.email ? { email: githubUser.email } : {}),
      });

      loginStore({
        accessToken,
        provider: "github",
        githubUser,
        authenticatedAt: Date.now(),
      });

      navigateRef.current(fromRef.current, { replace: true });
    } catch (err) {
      if ((err as Error).message === "cancelled") return;
      setGhFlow({
        step: "error",
        message: (err as Error).message || t("login.githubError"),
      });
    }
  }, [loginStore, updateProfile, t]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleCancelGitHub = () => {
    abortRef.current?.abort();
    setGhFlow({ step: "idle" });
  };

  const handleLogout = () => {
    logout();
    resetUserState();
    setGhFlow({ step: "idle" });
  };

  const switchView = (next: PageView) => {
    setView(next);
    setError("");
    setShowRegisterHint(false);
    if (next !== "github") return;
    abortRef.current?.abort();
    setGhFlow({ step: "idle" });
  };

  const goToRegisterWithEmail = () => {
    setError("");
    setShowRegisterHint(false);
    setConfirmPassword("");
    setName("");
    setView("register");
  };

  const githubUser = session?.githubUser;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (view === "login") handleEmailLogin();
    if (view === "register") handleRegister();
  };

  return (
    <div className="flex items-center justify-center min-h-full p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-emerald-300/10 via-teal-300/6 to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10 animate-fade-in-up">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-400/30 mb-2">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mozi</h1>
          <p className="text-sm text-muted-foreground">
            {isAuthenticated
              ? t("login.loggedIn")
              : view === "register"
                ? t("login.subtitleRegister")
                : t("login.subtitle")}
          </p>
        </div>

        {/* ── Logged-in state ── */}
        {isAuthenticated && githubUser && (
          <div className="space-y-6 animate-fade-in">
            <Card className="rounded-2xl border-border/50">
              <CardContent className="flex flex-col items-center gap-4 p-6">
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.login}
                  className="w-16 h-16 rounded-full ring-2 ring-emerald-400/30 shadow-lg"
                />
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {githubUser.name || githubUser.login}
                  </p>
                  <CardDescription>@{githubUser.login}</CardDescription>
                  {githubUser.email && (
                    <CardDescription className="text-xs">{githubUser.email}</CardDescription>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                  <Github className="h-3 w-3" />
                  GitHub {t("login.authorized")}
                </span>
              </CardContent>
            </Card>
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl hover:border-destructive/50 hover:text-destructive transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("login.logout")}
            </Button>
          </div>
        )}

        {/* ── Email Login ── */}
        {!isAuthenticated && view === "login" && (
          <div className="space-y-5 animate-fade-in">
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("login.emailPlaceholder")}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setShowRegisterHint(false);
                    }}
                    onKeyDown={handleKeyDown}
                    className="rounded-xl"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("login.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="rounded-xl pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">{error}</p>
                    {showRegisterHint && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                          {t("login.userNotFoundHint")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs h-7 rounded-lg border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                          onClick={goToRegisterWithEmail}
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          {t("login.goRegister")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition-all duration-200 hover:scale-[1.01]"
                  onClick={handleEmailLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {t("login.submit")}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("login.noAccount")}{" "}
                  <button
                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                    onClick={() => switchView("register")}
                  >
                    {t("login.goRegister")}
                  </button>
                </p>
              </CardContent>
            </Card>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{t("login.or")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl transition-all duration-200 hover:scale-[1.01]"
              onClick={() => switchView("github")}
            >
              <Github className="h-4 w-4 mr-2" />
              {t("login.github")}
            </Button>
          </div>
        )}

        {/* ── Register ── */}
        {!isAuthenticated && view === "register" && (
          <div className="space-y-5 animate-fade-in">
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">{t("login.name")}</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder={t("login.namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="rounded-xl"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">{t("login.email")}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder={t("login.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="rounded-xl"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t("login.password")}</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("login.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="rounded-xl pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">{t("login.confirmPassword")}</Label>
                  <Input
                    id="reg-confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("login.confirmPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="rounded-xl"
                    autoComplete="new-password"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  size="lg"
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition-all duration-200 hover:scale-[1.01]"
                  onClick={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {t("login.registerSubmit")}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("login.hasAccount")}{" "}
                  <button
                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                    onClick={() => switchView("login")}
                  >
                    {t("login.goLogin")}
                  </button>
                </p>
              </CardContent>
            </Card>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{t("login.or")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl transition-all duration-200 hover:scale-[1.01]"
              onClick={() => switchView("github")}
            >
              <Github className="h-4 w-4 mr-2" />
              {t("login.github")}
            </Button>
          </div>
        )}

        {/* ── GitHub login ── */}
        {!isAuthenticated && view === "github" && (
          <div className="space-y-5 animate-fade-in">
            <button
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => switchView("login")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("login.backToEmail")}
            </button>

            {ghFlow.step === "idle" && (
              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-xl transition-all duration-200 hover:scale-[1.01]"
                onClick={handleGitHubLogin}
              >
                <Github className="h-4 w-4 mr-2" />
                {t("login.github")}
              </Button>
            )}

            {ghFlow.step === "polling" && (
              <Card className="rounded-2xl border-border/50 animate-fade-in">
                <CardHeader className="pb-2">
                  <CardDescription className="text-center">
                    {t("login.deviceFlowHint")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <code className="text-2xl font-mono font-bold tracking-[0.25em] text-foreground bg-accent/60 px-4 py-2 rounded-xl">
                      {ghFlow.userCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopyCode(ghFlow.userCode)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
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

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("login.waitingAuth")}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={handleCancelGitHub}
                  >
                    {t("common.cancel")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {ghFlow.step === "error" && (
              <Card className="rounded-2xl border-destructive/30 bg-destructive/5 animate-fade-in">
                <CardContent className="p-4 text-center space-y-2">
                  <p className="text-sm text-destructive">{ghFlow.message}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setGhFlow({ step: "idle" })}
                  >
                    {t("login.retry")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
