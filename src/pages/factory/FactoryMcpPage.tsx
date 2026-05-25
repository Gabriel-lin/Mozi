import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, Loader2, Network, Plus, Copy, Trash2, Power, FileJson } from "lucide-react";
import {
  loadLocalMoziMcpJson,
  loadMoziMcpFileTextForEditor,
  parseMoziMcpConfigText,
  writeLocalMoziMcpJsonIfChanged,
} from "@/lib/moziMcpConfig";
import { workspaceApi, type WorkspaceInfo } from "@/services/workspace";
import {
  mcpApi,
  type BuiltinMcp,
  type ExternalMcpServer,
  type McpGatewayConfig,
} from "@/services/mcp";

export function FactoryMcpPage() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [builtin, setBuiltin] = useState<BuiltinMcp | null>(null);
  const [gateway, setGateway] = useState<McpGatewayConfig | null>(null);
  const [servers, setServers] = useState<ExternalMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [serversLoading, setServersLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regUrl, setRegUrl] = useState("");
  const [regAuthType, setRegAuthType] = useState<string>("none");
  const [regCredential, setRegCredential] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [pasteEditorLoading, setPasteEditorLoading] = useState(false);
  const pasteInitialNormalizedRef = useRef("");
  const mcpJsonFileInputRef = useRef<HTMLInputElement>(null);

  const loadWorkspace = useCallback(async () => {
    const res = await workspaceApi.list();
    const list = res?.workspaces ?? [];
    const activeId = res?.active_workspace_id;
    return list.find((w) => w.id === activeId) ?? list[0] ?? null;
  }, []);

  const refreshServers = useCallback(
    async (wsId: string) => {
      setServersLoading(true);
      try {
        const out = await mcpApi.listServers(wsId, { includeInactive: true });
        setServers(out.servers);
      } catch {
        toast.error(t("factory.mcpLoadError"));
        setServers([]);
      } finally {
        setServersLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ws, bi, gw] = await Promise.all([
          loadWorkspace(),
          mcpApi.getBuiltin(),
          mcpApi.getGatewayConfig(),
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setBuiltin(bi);
        setGateway(gw);
        if (ws) await refreshServers(ws.id);
      } catch {
        if (!cancelled) toast.error(t("factory.mcpLoadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace, refreshServers, t]);

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success(t("factory.mcpCopied"));
    } catch {
      toast.error(t("factory.mcpLoadError"));
    }
  };

  const resetAddForm = () => {
    setRegName("");
    setRegUrl("");
    setRegAuthType("none");
    setRegCredential("");
  };

  const handleRegister = async () => {
    if (!workspace || !regName.trim() || !regUrl.trim()) return;
    setRegSubmitting(true);
    try {
      await mcpApi.registerServer({
        name: regName.trim(),
        url: regUrl.trim(),
        workspace_id: workspace.id,
        transport: "streamable_http",
        auth_type: regAuthType === "none" ? null : regAuthType,
        auth_credential: regCredential.trim() || undefined,
      });
      toast.success(t("factory.mcpRegisterSuccess"));
      setAddOpen(false);
      resetAddForm();
      await refreshServers(workspace.id);
    } catch {
      toast.error(t("factory.mcpRegisterFail"));
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !workspace) return;
    try {
      await mcpApi.removeServer(deleteId);
      toast.success(t("factory.mcpDeleteSuccess"));
      setDeleteId(null);
      await refreshServers(workspace.id);
    } catch {
      toast.error(t("factory.mcpDeleteFail"));
    }
  };

  const runImportConfig = async (config: Record<string, unknown>, successToastKey?: string) => {
    if (!workspace) return;
    const out = await mcpApi.importConfig(workspace.id, config);
    await refreshServers(workspace.id);
    if (out.errors.length) {
      toast.warning(t("factory.mcpSyncPartial"), {
        description: out.errors.slice(0, 3).join("\n"),
      });
    } else {
      toast.success(t(successToastKey ?? "factory.mcpSyncSuccess"));
    }
  };

  const handleMcpJsonFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !workspace) return;
    setSyncBusy(true);
    try {
      const text = await file.text();
      const parsed = parseMoziMcpConfigText(text);
      if (!parsed.ok) {
        toast.error(t("factory.mcpInvalidJson"), { description: parsed.error });
        return;
      }
      await runImportConfig(parsed.data);
    } catch {
      toast.error(t("factory.mcpInvalidJson"), {
        description: t("factory.mcpInvalidJsonReadFail"),
      });
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSyncFromDisk = async () => {
    if (!workspace) return;
    const r = await loadLocalMoziMcpJson();
    if (!r.ok) {
      if (r.reason === "invalid_json") {
        toast.error(t("factory.mcpInvalidJsonOnDisk"));
      } else if (r.reason === "fs_error") {
        toast.error(t("factory.mcpFileFsError"), { description: r.detail });
      } else {
        mcpJsonFileInputRef.current?.click();
      }
      return;
    }
    setSyncBusy(true);
    try {
      await runImportConfig(r.data, r.created ? "factory.mcpFileCreatedAndSynced" : undefined);
    } catch {
      toast.error(t("factory.mcpRegisterFail"));
    } finally {
      setSyncBusy(false);
    }
  };

  const openMcpJsonEditor = async () => {
    if (!workspace) return;
    setPasteOpen(true);
    setPasteEditorLoading(true);
    setPasteText("");
    pasteInitialNormalizedRef.current = "";
    try {
      const r = await loadMoziMcpFileTextForEditor();
      if (!r.ok) {
        if (r.reason === "invalid_json") {
          toast.error(t("factory.mcpInvalidJson"), { description: r.detail });
        } else {
          toast.error(t("factory.mcpFileFsError"), { description: r.detail });
        }
        const fb = parseMoziMcpConfigText(JSON.stringify({ mcpServers: {} }));
        if (fb.ok) {
          pasteInitialNormalizedRef.current = fb.normalized;
          setPasteText(fb.normalized);
        }
        return;
      }
      pasteInitialNormalizedRef.current = r.normalizedText;
      setPasteText(r.normalizedText);
    } catch {
      toast.error(t("factory.mcpInvalidJson"), {
        description: t("factory.mcpInvalidJsonReadFail"),
      });
      const fb = parseMoziMcpConfigText(JSON.stringify({ mcpServers: {} }));
      if (fb.ok) {
        pasteInitialNormalizedRef.current = fb.normalized;
        setPasteText(fb.normalized);
      }
    } finally {
      setPasteEditorLoading(false);
    }
  };

  const handleMcpJsonEditorTextareaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const indent = "  ";

      let nextText: string;
      let caret: number;

      if (e.shiftKey) {
        const before = pasteText.slice(0, start);
        const after = pasteText.slice(end);
        const lineStart = Math.max(0, before.lastIndexOf("\n") + 1);
        const prefix = before.slice(lineStart);
        if (prefix.startsWith(indent)) {
          nextText = before.slice(0, lineStart) + prefix.slice(indent.length) + after;
          caret = Math.max(lineStart, start - indent.length);
        } else if (prefix.startsWith("\t")) {
          nextText = before.slice(0, lineStart) + prefix.slice(1) + after;
          caret = Math.max(lineStart, start - 1);
        } else {
          return;
        }
      } else {
        nextText = pasteText.slice(0, start) + indent + pasteText.slice(end);
        caret = start + indent.length;
      }

      setPasteText(nextText);
      window.setTimeout(() => {
        el.selectionStart = el.selectionEnd = caret;
      }, 0);
    },
    [pasteText],
  );

  const handleMcpJsonEditorConfirm = async () => {
    if (!workspace || !pasteText.trim()) return;
    setPasteSubmitting(true);
    try {
      const parsed = parseMoziMcpConfigText(pasteText);
      if (!parsed.ok) {
        toast.error(t("factory.mcpInvalidJson"), { description: parsed.error });
        return;
      }
      const { normalized, data: config } = parsed;
      let wrote = false;
      try {
        wrote = await writeLocalMoziMcpJsonIfChanged(normalized, pasteInitialNormalizedRef.current);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        toast.error(t("factory.mcpFileFsError"), { description: detail.slice(0, 300) });
        return;
      }
      if (wrote) {
        toast.success(t("factory.mcpJsonSavedToDisk"));
      }
      setPasteOpen(false);
      setPasteText("");
      pasteInitialNormalizedRef.current = "";
      try {
        await runImportConfig(config);
      } catch {
        toast.error(t("factory.mcpRegisterFail"));
      }
    } finally {
      setPasteSubmitting(false);
    }
  };

  const handleToggle = async (row: ExternalMcpServer) => {
    if (!workspace) return;
    setToggleBusy(row.id);
    try {
      await mcpApi.updateServer(row.id, { is_active: !row.is_active });
      toast.success(t("factory.mcpToggleSuccess"));
      await refreshServers(workspace.id);
    } catch {
      toast.error(t("factory.mcpToggleFail"));
    } finally {
      setToggleBusy(null);
    }
  };

  return (
    <>
      <input
        ref={mcpJsonFileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(ev) => {
          void handleMcpJsonFileChange(ev);
        }}
      />
      <SubPageLayout
        titleKey="factory.mcpPageTitle"
        descriptionKey="factory.mcpPageDesc"
        icon={Globe}
        iconGradient="from-sky-400 to-indigo-600"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 h-9 px-3"
              disabled={!workspace || syncBusy}
              onClick={() => {
                void handleSyncFromDisk();
              }}
            >
              {syncBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              {t("factory.mcpSyncFromMcpJson")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 h-9 px-3"
              disabled={!workspace || pasteEditorLoading}
              onClick={() => {
                void openMcpJsonEditor();
              }}
            >
              <FileJson className="h-4 w-4" />
              {t("factory.mcpEditMcpJson")}
            </Button>
            <Button
              size="sm"
              className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
              disabled={!workspace}
              onClick={() => {
                resetAddForm();
                setAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("factory.mcpAddServer")}
            </Button>
          </div>
        }
      >
        {workspace && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
              {workspace.type === "local" ? t("profile.localType") : t("profile.remoteType")}
            </span>
            <span className="truncate">{workspace.name}</span>
          </div>
        )}

        {!workspace && !loading && (
          <p className="text-sm text-muted-foreground py-4">{t("factory.mcpNoWorkspace")}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="rounded-2xl border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/15 to-indigo-500/15">
                    <Network className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t("factory.mcpSectionBuiltinTitle")}</CardTitle>
                    <CardDescription>{t("factory.mcpSectionBuiltinDesc")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {builtin && (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span className="text-muted-foreground">{t("factory.toolName")}</span>
                      <span className="font-medium">{builtin.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span className="text-muted-foreground">{t("factory.mcpVersion")}</span>
                      <span className="font-mono text-xs">{builtin.version}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground shrink-0">
                        {t("factory.mcpEndpointLabel")}
                      </span>
                      <code className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono">
                        {builtin.endpoint_path}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 rounded-lg"
                        onClick={() => handleCopyPath(builtin.endpoint_path)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t("factory.mcpCopyPath")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {builtin.description}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("factory.mcpSectionGatewayTitle")}</CardTitle>
                <CardDescription>{t("factory.mcpSectionGatewayDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {gateway && (
                  <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t("factory.mcpGatewayPath")}</dt>
                      <dd className="font-mono text-xs mt-0.5">{gateway.streamable_http_path}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("factory.mcpGatewayTimeout")}</dt>
                      <dd className="font-medium mt-0.5">{gateway.proxy_http_timeout_seconds}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("factory.toolName")}</dt>
                      <dd className="font-medium mt-0.5">{gateway.server_name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("factory.mcpVersion")}</dt>
                      <dd className="font-mono text-xs mt-0.5">{gateway.server_version}</dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("factory.mcpSectionExternalTitle")}</CardTitle>
                <CardDescription>{t("factory.mcpSectionExternalDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{t("factory.mcpJsonUserPath")}</p>
                {!workspace ? null : serversLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : servers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    {t("factory.mcpExternalEmpty")}
                  </p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("factory.mcpServerDisplayName")}</TableHead>
                          <TableHead>{t("factory.mcpColumnTransport")}</TableHead>
                          <TableHead>{t("factory.mcpServerUrl")}</TableHead>
                          <TableHead className="w-[100px]">{t("factory.mcpStatus")}</TableHead>
                          <TableHead className="w-[120px] text-right">
                            {t("factory.mcpColumnActions")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servers.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-xs font-mono uppercase text-muted-foreground">
                              {s.transport}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate font-mono text-xs"
                              title={s.url ?? ""}
                            >
                              {s.url ?? "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  s.is_active
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground"
                                }
                              >
                                {s.is_active ? t("factory.mcpActive") : t("factory.mcpInactive")}
                              </span>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={toggleBusy === s.id}
                                onClick={() => handleToggle(s)}
                                title={
                                  s.is_active ? t("factory.mcpInactive") : t("factory.mcpActive")
                                }
                              >
                                {toggleBusy === s.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(s.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </SubPageLayout>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("factory.mcpAddServerTitle")}</DialogTitle>
            <DialogDescription>{t("factory.mcpSectionExternalDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="mcp-reg-name">{t("factory.mcpServerDisplayName")}</Label>
              <Input
                id="mcp-reg-name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-reg-url">{t("factory.mcpServerUrl")}</Label>
              <Input
                id="mcp-reg-url"
                placeholder="https://..."
                value={regUrl}
                onChange={(e) => setRegUrl(e.target.value)}
                className="rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("factory.mcpAuthType")}</Label>
              <Select value={regAuthType} onValueChange={setRegAuthType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("factory.mcpAuthNone")}</SelectItem>
                  <SelectItem value="bearer">{t("factory.mcpAuthBearer")}</SelectItem>
                  <SelectItem value="api_key">{t("factory.mcpAuthApiKey")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {regAuthType !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="mcp-reg-cred">{t("factory.mcpAuthCredential")}</Label>
                <Input
                  id="mcp-reg-cred"
                  type="password"
                  autoComplete="off"
                  value={regCredential}
                  onChange={(e) => setRegCredential(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="rounded-xl gap-2"
              disabled={regSubmitting || !regName.trim() || !regUrl.trim()}
              onClick={handleRegister}
            >
              {regSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("factory.mcpAddServer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pasteOpen}
        onOpenChange={(open) => {
          setPasteOpen(open);
          if (!open) {
            pasteInitialNormalizedRef.current = "";
            setPasteText("");
            setPasteEditorLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("factory.mcpJsonEditorTitle")}</DialogTitle>
            <DialogDescription>{t("factory.mcpJsonEditorHint")}</DialogDescription>
          </DialogHeader>
          {pasteEditorLoading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-muted/30">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onKeyDown={handleMcpJsonEditorTextareaKeyDown}
              placeholder={`{\n  "mcpServers": {}\n}`}
              rows={16}
              spellCheck={false}
              className="rounded-xl font-mono text-xs min-h-[260px] leading-relaxed"
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={pasteSubmitting}
              onClick={() => {
                setPasteOpen(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="rounded-xl gap-2"
              disabled={pasteSubmitting || pasteEditorLoading || !pasteText.trim()}
              onClick={() => {
                void handleMcpJsonEditorConfirm();
              }}
            >
              {pasteSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("factory.mcpJsonConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("factory.mcpDeleteServer")}</AlertDialogTitle>
            <AlertDialogDescription>{t("factory.mcpDeleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("factory.mcpDeleteServer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
