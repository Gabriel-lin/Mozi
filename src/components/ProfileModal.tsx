import React, { useState } from "react";
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
} from "lucide-react";
import { ProfileSettings, mockProfileSettings } from "../types/profile";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { useUserStore } from "../stores/userStore";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: ProfileSettings;
}

export function ProfileModal({
  open,
  onOpenChange,
  profile = mockProfileSettings,
}: ProfileModalProps) {
  const { t, i18n } = useTranslation();

  // Use user store
  const {
    profile: storeProfile,
    workspaces: storeWorkspaces,
    permissions,
    roles,
    currentRoleId,
    updateUsername,
    updateEmail,
    updatePhone,
    updateGithub,
    setActiveWorkspace,
  } = useUserStore();

  const [isGitHubConnected, setIsGitHubConnected] = useState(!!storeProfile.github);

  // Use store data, fallback to profile props if store is not initialized
  const workspaces = storeWorkspaces.length > 0 ? storeWorkspaces : profile.workspaces;

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
  };

  const handleGitHubConnect = () => {
    // GitHub OAuth 3方授权 - 这里模拟打开授权页面
    const clientId = "your_github_client_id";
    const redirectUri = encodeURIComponent("http://localhost:1420/oauth/callback");
    const scope = "user:email,read:user";
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

    // 实际项目中应该打开新窗口或使用Tauri的shell打开
    console.log("Opening GitHub OAuth:", githubAuthUrl);

    // 模拟授权成功后的回调 - 更新 store
    updateGithub("mozi-user");
    setIsGitHubConnected(true);
  };

  const handleGitHubDisconnect = () => {
    updateGithub("");
    setIsGitHubConnected(false);
  };

  // 用户信息编辑状态
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localUserData, setLocalUserData] = useState({
    username: storeProfile.username,
    email: storeProfile.email,
    phone: storeProfile.phone,
  });

  const handleEdit = (field: string) => {
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
                    <p className="text-xs text-muted-foreground">{storeProfile.github}</p>
                  )}
                </div>
              </div>
              {isGitHubConnected ? (
                <Button variant="outline" size="sm" onClick={handleGitHubDisconnect}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {t("profile.githubDisconnect")}
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleGitHubConnect}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {t("profile.githubAuth")}
                </Button>
              )}
            </div>
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
