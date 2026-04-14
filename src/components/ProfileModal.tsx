import React, { useMemo, useState, useRef, useCallback } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Monitor,
  Server,
  FolderOpen,
  Github,
  ExternalLink,
  CheckCircle,
  XCircle,
  User,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  Globe,
  Loader2,
  Copy,
} from "lucide-react";
import {
  type ProfileSettings,
  useUserStore,
  DEFAULT_PROFILE,
  DEFAULT_WORKSPACES,
} from "@mozi/store";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import {
  requestDeviceCode,
  openVerificationPage,
  pollForAccessToken,
} from "@/services/github-oauth";
import { api, ApiError } from "@/services/api";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: ProfileSettings;
}

export function ProfileModal({
  open,
  onOpenChange,
  profile = { user: DEFAULT_PROFILE, workspaces: DEFAULT_WORKSPACES },
}: ProfileModalProps) {
  const { t, i18n } = useTranslation();

  const {
    profile: storeProfile,
    workspaces: storeWorkspaces,
    updateUsername,
    updateEmail,
    updatePhone,
    updateGithub,
    updateAvatar,
    setActiveWorkspace,
  } = useUserStore();

  const isGitHubConnected = useMemo(() => !!storeProfile.github, [storeProfile.github]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localUserData, setLocalUserData] = useState({
    username: storeProfile.username,
    email: storeProfile.email,
    phone: storeProfile.phone,
  });

  const [ghLinking, setGhLinking] = useState<
    | { step: "idle" }
    | { step: "polling"; userCode: string; verificationUri: string }
    | { step: "error"; message: string }
  >({ step: "idle" });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const workspaces = storeWorkspaces.length > 0 ? storeWorkspaces : profile.workspaces;

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleGitHubConnect = useCallback(async () => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const deviceCode = await requestDeviceCode();
      setGhLinking({
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
      updateGithub(user.github_login);
      updateAvatar(user.avatar || "");
      setGhLinking({ step: "idle" });
    } catch (err) {
      if ((err as Error).message === "cancelled") {
        setGhLinking({ step: "idle" });
        return;
      }
      const msg = err instanceof ApiError ? err.code : (err as Error).message;
      setGhLinking({ step: "error", message: msg });
    }
  }, [updateGithub, updateAvatar]);

  const handleGitHubDisconnect = useCallback(async () => {
    abortRef.current?.abort();
    setGhLinking({ step: "idle" });
    try {
      await api.post("/auth/github/unlink");
      updateGithub("");
    } catch (err) {
      console.error("GitHub unlink failed:", err);
    }
  }, [updateGithub]);

  const handleEdit = (field: string) => {
    setLocalUserData({
      username: storeProfile.username,
      email: storeProfile.email,
      phone: storeProfile.phone,
    });
    setEditingField(field);
  };

  const handleSave = (field: string) => {
    // Update store with new values
    if (field === "username") {
      updateUsername(localUserData.username);
    } else if (field === "email") {
      updateEmail(localUserData.email);
    } else if (field === "phone") {
      updatePhone(localUserData.phone);
    }
    setEditingField(null);
  };

  const handleCancel = () => {
    setLocalUserData({
      username: storeProfile.username,
      email: storeProfile.email,
      phone: storeProfile.phone,
    });
    setEditingField(null);
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <ModalHeader>
          <ModalTitle>{t("profile.title")}</ModalTitle>
          <ModalDescription>{t("profile.description")}</ModalDescription>
        </ModalHeader>

        <div className="space-y-6 py-4">
          {/* 用户信息部分 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
              <User className="h-4 w-4" />
              {t("profile.userInfo")}
            </h3>

            <div className="flex items-start gap-4 p-4 rounded-lg border border-border">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
                {storeProfile.avatar && storeProfile.avatar !== "user" ? (
                  <img
                    src={storeProfile.avatar}
                    alt={storeProfile.username}
                    className="h-20 w-20 object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-white" />
                )}
              </div>
              <div className="flex-1 space-y-3">
                {/* 用户名 */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">{t("profile.name")}</label>
                    {editingField === "username" ? (
                      <div className="flex items-center gap-0.5 mt-1">
                        <Input
                          value={localUserData.username}
                          onChange={(e) =>
                            setLocalUserData({ ...localUserData, username: e.target.value })
                          }
                          className="h-7 flex-1 bg-background border-input text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => handleSave("username")}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={handleCancel}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium mt-1 text-foreground">
                        {localUserData.username || t("profile.notSet")}
                      </p>
                    )}
                  </div>
                  {!editingField && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-8 w-8 p-0"
                      onClick={() => handleEdit("username")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 邮箱 */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {t("profile.email")}
                    </label>
                    {editingField === "email" ? (
                      <div className="flex items-center gap-0.5 mt-1">
                        <Input
                          type="email"
                          value={localUserData.email}
                          onChange={(e) =>
                            setLocalUserData({ ...localUserData, email: e.target.value })
                          }
                          className="h-7 flex-1 bg-background border-input text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => handleSave("email")}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={handleCancel}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground mt-1">
                        {localUserData.email || t("profile.notSet")}
                      </p>
                    )}
                  </div>
                  {!editingField && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-8 w-8 p-0"
                      onClick={() => handleEdit("email")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 联系电话 */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {t("profile.phone")}
                    </label>
                    {editingField === "phone" ? (
                      <div className="flex items-center gap-0.5 mt-1">
                        <Input
                          type="tel"
                          value={localUserData.phone}
                          onChange={(e) =>
                            setLocalUserData({ ...localUserData, phone: e.target.value })
                          }
                          className="h-7 flex-1 bg-background border-input text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => handleSave("phone")}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={handleCancel}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground mt-1">
                        {localUserData.phone || t("profile.notSet")}
                      </p>
                    )}
                  </div>
                  {!editingField && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-8 w-8 p-0"
                      onClick={() => handleEdit("phone")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 语言设置部分 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Globe className="h-4 w-4" />
              {t("profile.language")}
            </h3>

            <div className="flex items-center gap-2">
              <Button
                variant={i18n.language === "zh" ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  await i18n.changeLanguage("zh");
                  try {
                    await emit("set-language", "zh");
                  } catch {
                    // 非 Tauri 环境
                  }
                }}
              >
                中文
              </Button>
              <Button
                variant={i18n.language === "en" ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  await i18n.changeLanguage("en");
                  try {
                    await emit("set-language", "en");
                  } catch {
                    // 非 Tauri 环境
                  }
                }}
              >
                English
              </Button>
            </div>
          </div>

          {/* GitHub 绑定 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Github className="h-4 w-4" />
              {t("profile.github")}
            </h3>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5 text-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isGitHubConnected
                      ? t("profile.githubConnected")
                      : t("profile.githubNotConnected")}
                  </p>
                  {isGitHubConnected && storeProfile.github && (
                    <p className="text-xs text-muted-foreground">@{storeProfile.github}</p>
                  )}
                </div>
              </div>
              {isGitHubConnected ? (
                <Button variant="outline" size="sm" onClick={handleGitHubDisconnect}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {t("profile.githubDisconnect")}
                </Button>
              ) : ghLinking.step === "idle" ? (
                <Button variant="default" size="sm" onClick={handleGitHubConnect}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {t("profile.githubAuth")}
                </Button>
              ) : null}
            </div>

            {ghLinking.step === "polling" && (
              <div className="p-3 rounded-lg border border-border space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  {t("login.deviceFlowHint")}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-lg font-mono font-bold tracking-[0.2em] text-foreground bg-accent/60 px-3 py-1 rounded-lg">
                    {ghLinking.userCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopyCode(ghLinking.userCode)}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("login.waitingAuth")}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleGitHubDisconnect}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            )}

            {ghLinking.step === "error" && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-center space-y-2">
                <p className="text-xs text-destructive">{ghLinking.message}</p>
                <Button variant="outline" size="sm" onClick={() => setGhLinking({ step: "idle" })}>
                  {t("login.retry")}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t("profile.githubAuthTip")}</p>
          </div>

          {/* 工作区设置部分 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
              <FolderOpen className="h-4 w-4" />
              {t("profile.workspace")}
            </h3>

            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    workspace.isActive ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleWorkspaceClick(workspace.id)}
                >
                  {/* 右上角状态徽章 */}
                  <div className="absolute top-2 right-2">
                    {workspace.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <CheckCircle className="h-3 w-3" />
                        {t("profile.active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3" />
                        {t("profile.inactive")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pr-20">
                    {workspace.type === "local" ? (
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Server className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {workspace.name}
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {workspace.type === "local"
                            ? t("profile.localType")
                            : t("profile.remoteType")}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">{workspace.path}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full">
              {t("profile.addWorkspace")}
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t dark:border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("profile.cancel")}
          </Button>
          <Button>{t("profile.save")}</Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
