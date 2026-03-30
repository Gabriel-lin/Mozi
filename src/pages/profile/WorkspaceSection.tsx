import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Monitor,
  Server,
  FolderOpen,
  CheckCircle,
  Pencil,
  Check,
  X,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@mozi/store";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { api } from "@/services/api";

interface WsItem {
  id: string;
  name: string;
  type: "local" | "remote";
  path: string | null;
  slug: string;
  owner_id: string;
}

interface WsListResponse {
  workspaces: WsItem[];
  active_workspace_id: string | null;
}

export function WorkspaceSection() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [workspaces, setWorkspaces] = useState<WsItem[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!isAuthenticated) return;
    setWsLoading(true);
    try {
      const data = await api.get<WsListResponse>("/workspaces/");
      const list = data.workspaces ?? [];
      setWorkspaces(list);
      const backendActive = data.active_workspace_id;
      if (backendActive && list.some((w) => w.id === backendActive)) {
        setActiveWsId(backendActive);
      } else if (list.length > 0) {
        setActiveWsId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
    } finally {
      setWsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleActivateWorkspace = useCallback(async (wsId: string) => {
    setActiveWsId(wsId);
    try {
      await api.post(`/workspaces/${wsId}/activate`);
    } catch (err) {
      console.error("Failed to activate workspace:", err);
    }
  }, []);

  // ── Add Dialog ──
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newWsType, setNewWsType] = useState<"local" | "remote">("local");
  const [newWsName, setNewWsName] = useState("");
  const [newWsPath, setNewWsPath] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const resetAddForm = () => {
    setNewWsType("local");
    setNewWsName("");
    setNewWsPath("");
  };

  const handleAddWorkspace = async () => {
    if (!newWsName.trim()) return;
    setAddLoading(true);
    try {
      const slug =
        newWsName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "ws";
      await api.post("/workspaces/", {
        name: newWsName.trim(),
        slug,
        type: newWsType,
        path: newWsPath.trim() || null,
      });
      setAddDialogOpen(false);
      resetAddForm();
      await fetchWorkspaces();
    } catch (err) {
      console.error("Failed to create workspace:", err);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit ──
  const [editWsId, setEditWsId] = useState<string | null>(null);
  const [editWsName, setEditWsName] = useState("");

  const handleStartEdit = (ws: WsItem) => {
    setEditWsId(ws.id);
    setEditWsName(ws.name);
  };
  const handleSaveEdit = async () => {
    if (!editWsId || !editWsName.trim()) return;
    try {
      await api.patch(`/workspaces/${editWsId}`, { name: editWsName.trim() });
      setEditWsId(null);
      await fetchWorkspaces();
    } catch (err) {
      console.error("Failed to update workspace:", err);
    }
  };
  const handleCancelEdit = () => setEditWsId(null);

  // ── Delete ──
  const handleDeleteWorkspace = async (wsId: string) => {
    try {
      await api.delete(`/workspaces/${wsId}`);
      await fetchWorkspaces();
    } catch (err) {
      console.error("Failed to delete workspace:", err);
    }
  };

  return (
    <>
      <section className="space-y-4 animate-fade-in-up stagger-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5" />
          {t("profile.workspace")}
        </h3>

        <div className="space-y-3">
          {wsLoading && workspaces.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWsId;
            const isEditing = editWsId === ws.id;
            return (
              <div
                key={ws.id}
                className={`group relative rounded-2xl glass premium-shadow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg overflow-hidden ${isActive ? "ring-1 ring-primary/30" : ""}`}
              >
                <div className="flex items-center gap-4 p-5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${isActive ? "bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 shadow-lg shadow-emerald-400/25" : "bg-muted"} transition-all duration-300 cursor-pointer`}
                    onClick={() => handleActivateWorkspace(ws.id)}
                  >
                    {ws.type === "local" ? (
                      <Monitor
                        className={`h-5 w-5 ${isActive ? "text-white" : "text-muted-foreground"}`}
                      />
                    ) : (
                      <Server
                        className={`h-5 w-5 ${isActive ? "text-white" : "text-muted-foreground"}`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => handleActivateWorkspace(ws.id)}>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editWsName}
                          onChange={(e) => setEditWsName(e.target.value)}
                          className="h-8 text-sm rounded-lg"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={handleSaveEdit}
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate cursor-pointer">
                            {ws.name}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
                            {ws.type === "local" ? t("profile.localType") : t("profile.remoteType")}
                          </span>
                        </div>
                        {ws.path && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ws.path}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && !isEditing && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mr-1">
                        <CheckCircle className="h-3 w-3" />
                        {t("profile.active")}
                      </span>
                    )}
                    {!isEditing && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(ws);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={workspaces.length <= 1}
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:group-hover:opacity-50 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          style={
                            workspaces.length <= 1
                              ? { pointerEvents: "auto", cursor: "not-allowed" }
                              : undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (workspaces.length > 1) handleDeleteWorkspace(ws.id);
                          }}
                          title={workspaces.length <= 1 ? t("profile.lastWorkspaceHint") : ""}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          className="w-full rounded-xl h-10 gap-2 border-dashed border-border/60 hover:border-border transition-all duration-200"
          onClick={() => {
            resetAddForm();
            setAddDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("profile.addWorkspace")}
        </Button>
      </section>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("profile.addWorkspace")}</DialogTitle>
            <DialogDescription>{t("profile.addWorkspaceDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("profile.wsType")}
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newWsType === "local" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 rounded-xl h-10 gap-2"
                  onClick={() => setNewWsType("local")}
                >
                  <Monitor className="h-4 w-4" /> {t("profile.localType")}
                </Button>
                <Button
                  type="button"
                  variant={newWsType === "remote" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 rounded-xl h-10 gap-2"
                  onClick={() => setNewWsType("remote")}
                >
                  <Server className="h-4 w-4" /> {t("profile.remoteType")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="ws-name"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {t("profile.wsName")}
              </Label>
              <Input
                id="ws-name"
                placeholder={
                  newWsType === "local"
                    ? t("profile.wsNameLocalPlaceholder")
                    : t("profile.wsNameRemotePlaceholder")
                }
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="ws-path"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {newWsType === "local" ? t("profile.wsPath") : t("profile.wsRemoteAddr")}
              </Label>
              {newWsType === "local" ? (
                <div
                  className="flex items-center gap-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={async () => {
                    try {
                      const selected = await openFolderDialog({
                        directory: true,
                        multiple: false,
                        title: t("profile.wsSelectFolder"),
                      });
                      if (selected) setNewWsPath(selected as string);
                    } catch {}
                  }}
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span
                    className={`flex-1 truncate ${newWsPath ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {newWsPath || t("profile.wsSelectFolder")}
                  </span>
                </div>
              ) : (
                <Input
                  id="ws-path"
                  placeholder="user@host:/path"
                  value={newWsPath}
                  onChange={(e) => setNewWsPath(e.target.value)}
                  className="rounded-xl"
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                {newWsType === "local" ? t("profile.wsPathHint") : t("profile.wsRemoteHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setAddDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="rounded-xl gap-2"
              disabled={!newWsName.trim() || addLoading}
              onClick={handleAddWorkspace}
            >
              {addLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("profile.addWorkspace")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
