import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Globe, Loader2, Plug } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toolkitApi, type Toolkit } from "@/services/toolkit";
import { workspaceApi, type WorkspaceMcpServer } from "@/services/workspace";

export interface RegisterToolkitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (toolkit: Toolkit) => void;
  /** Used to list MCP servers and validate registration for source=mcp */
  workspaceId: string | null;
}

export function RegisterToolkitDialog({
  open,
  onOpenChange,
  onRegistered,
  workspaceId,
}: RegisterToolkitDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<"mcp" | "custom">("custom");
  const [mcpServerId, setMcpServerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState<WorkspaceMcpServer[]>([]);
  const [mcpServersLoading, setMcpServersLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setName("");
      setDescription("");
      setSource("custom");
      setMcpServerId("");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!open || !workspaceId) {
        setMcpServers([]);
        setMcpServersLoading(false);
        return;
      }
      setMcpServersLoading(true);
      try {
        const res = await workspaceApi.listMcpServers(workspaceId);
        if (!cancelled) setMcpServers(res.servers);
      } catch {
        if (!cancelled) {
          setMcpServers([]);
          toast.error(t("factory.mcpServerListLoadError"));
        }
      } finally {
        if (!cancelled) setMcpServersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, t]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (source === "mcp" && (!workspaceId || !mcpServerId)) return;
    setLoading(true);
    try {
      const newTk = await toolkitApi.register({
        name: name.trim(),
        description: description.trim() || undefined,
        source,
        mcp_server_id: source === "mcp" ? mcpServerId : undefined,
        workspace_id: source === "mcp" ? (workspaceId ?? undefined) : undefined,
      });
      onRegistered(newTk);
      onOpenChange(false);
      toast.success(t("factory.registerSuccess", { name: newTk.name }));
    } catch {
      toast.error(t("factory.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const mcpBlocked = source === "mcp" && !workspaceId;

  const proxyableMcpServers = useMemo(
    () => mcpServers.filter((s) => s.transport === "streamable_http" && !!s.url?.trim()),
    [mcpServers],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("factory.registerTool")}</DialogTitle>
          <DialogDescription>{t("factory.registerToolDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("factory.toolSource")}
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={source === "custom" ? "default" : "outline"}
                size="sm"
                className="flex-1 rounded-xl h-10 gap-2"
                onClick={() => setSource("custom")}
              >
                <Plug className="h-4 w-4" /> {t("factory.sourceCustom")}
              </Button>
              <Button
                type="button"
                variant={source === "mcp" ? "default" : "outline"}
                size="sm"
                className="flex-1 rounded-xl h-10 gap-2"
                onClick={() => setSource("mcp")}
              >
                <Globe className="h-4 w-4" /> {t("factory.sourceMcp")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="reg-tool-name"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              {t("factory.toolName")}
            </Label>
            <Input
              id="reg-tool-name"
              placeholder={t("factory.toolNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="reg-tool-desc"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              {t("factory.registerDescLabel")}
            </Label>
            <Textarea
              id="reg-tool-desc"
              placeholder={t("factory.toolDescPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="rounded-xl min-h-[100px] resize-y"
            />
          </div>

          {source === "mcp" && (
            <div className="space-y-2">
              <Label
                htmlFor="reg-tool-mcp"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {t("factory.mcpServerSelectLabel")}
              </Label>
              {mcpBlocked ? (
                <p className="text-sm text-muted-foreground">{t("factory.mcpNeedsWorkspace")}</p>
              ) : (
                <>
                  <div className="relative">
                    {mcpServersLoading && (
                      <Loader2 className="pointer-events-none absolute right-9 top-1/2 z-10 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                    <Select
                      value={mcpServerId || undefined}
                      onValueChange={setMcpServerId}
                      disabled={mcpServersLoading}
                    >
                      <SelectTrigger
                        id="reg-tool-mcp"
                        className={cn("rounded-xl", mcpServersLoading && "pr-10")}
                        aria-busy={mcpServersLoading}
                      >
                        <SelectValue placeholder={t("factory.mcpServerSelectPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {proxyableMcpServers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!mcpServersLoading && mcpServers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("factory.mcpServerListEmpty")}
                    </p>
                  )}
                  {!mcpServersLoading &&
                    mcpServers.length > 0 &&
                    proxyableMcpServers.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t("factory.mcpToolkitHttpOnlyHint")}
                      </p>
                    )}
                  <p className="text-[11px] text-muted-foreground">
                    {t("factory.mcpServerSelectHint")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            className="rounded-xl gap-2"
            disabled={
              !name.trim() || loading || (source === "mcp" && (!workspaceId || !mcpServerId))
            }
            onClick={handleSubmit}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("factory.registerTool")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
