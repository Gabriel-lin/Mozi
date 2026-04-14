import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Pagination } from "@/components/Pagination";
import { workflowApi, type Workflow } from "@/services/workflow";
import { workspaceApi } from "@/services/workspace";
import {
  GitBranch,
  Plus,
  ArrowLeft,
  Play,
  Settings,
  ChevronRight,
  CircleDot,
  Trash2,
  Loader2,
  X,
} from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-400/10 text-zinc-500 dark:text-zinc-400",
  active: "bg-blue-400/10 text-blue-500 dark:text-blue-400",
  archived: "bg-amber-400/10 text-amber-600 dark:text-amber-400",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export function WorkflowPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    workspaceApi
      .list()
      .then((res) => {
        const first = res?.workspaces?.[0];
        if (first) setWorkspaceId(first.id);
      })
      .catch(() => {});
  }, []);

  const fetchWorkflows = useCallback(
    async (p = 1, ps = pageSize) => {
      if (!workspaceId) return;
      try {
        setLoading(true);
        const res = await workflowApi.list(workspaceId, p, ps);
        setWorkflows(res?.workflows ?? []);
        setTotal(res?.total ?? 0);
        setPage(res?.page ?? p);
      } catch {
        // silently fail – list stays empty
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    },
    [workspaceId, pageSize],
  );

  const pageRef = React.useRef(page);
  pageRef.current = page;

  useEffect(() => {
    fetchWorkflows(pageRef.current);
  }, [fetchWorkflows]);

  const handleDeleteClick = (e: React.MouseEvent, wf: Workflow) => {
    e.stopPropagation();
    setDeleteTarget(wf);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    const id = deleteTarget.id;
    const name = deleteTarget.name;
    setDeleteTarget(null);
    try {
      setDeleting(id);
      await workflowApi.delete(id);
      toast.success(t("workflow.deleteSuccess", `工作流「${name}」已删除`));
      const nextPage = workflows.length === 1 && page > 1 ? page - 1 : page;
      await fetchWorkflows(nextPage);
    } catch {
      toast.error(t("workflow.deleteFailed", "删除失败，请重试"));
    } finally {
      setDeleting(null);
    }
  };

  const handlePageChange = (p: number) => fetchWorkflows(p);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    fetchWorkflows(1, size);
  };

  const handleRun = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (running) return;
    try {
      setRunning(id);
      await workflowApi.run(id);
      toast.success(t("workflow.runStarted", "工作流已开始运行"));
    } catch {
      toast.error(t("workflow.runFailed", "运行失败，请重试"));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("nav.workflow")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("workflow.description", "设计和编排工作流")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl shadow-lg shadow-primary/20 gap-1.5 h-9 px-4"
          onClick={() => navigate("/workflow/create")}
        >
          <Plus className="h-4 w-4" />
          {t("workflow.create", "新建工作流")}
        </Button>
      </div>

      {/* List */}
      {!initialized ? (
        <div className="rounded-2xl glass premium-shadow overflow-hidden divide-y divide-border/40">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-5 animate-pulse">
              <div className="h-11 w-11 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-5">
          <div className="relative">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 text-white shadow-xl shadow-blue-400/25">
              <GitBranch className="h-8 w-8" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 opacity-20 blur-xl" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-base font-semibold text-foreground">{t("nav.workflow")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("workflow.empty", "暂无工作流，点击右上角新建")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 mt-1"
            onClick={() => navigate("/workflow/create")}
          >
            <Plus className="h-4 w-4" />
            {t("workflow.create", "新建工作流")}
          </Button>
        </div>
      ) : (
        <div className="relative rounded-2xl glass premium-shadow overflow-y-auto max-h-[calc(100vh-320px)] divide-y divide-border/40">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="group flex items-center gap-4 p-5 hover:bg-accent/30 transition-all duration-200 cursor-pointer"
              onClick={() => navigate(`/workflow/${wf.id}/edit`)}
            >
              <div className="relative">
                <div className="p-3 rounded-xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25">
                  <GitBranch className="h-5 w-5" />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground truncate">{wf.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[wf.status] ?? STATUS_STYLE.draft}`}
                  >
                    <CircleDot className="h-2.5 w-2.5" />
                    {STATUS_LABEL[wf.status] ?? wf.status}
                  </span>
                </div>
                {wf.description && (
                  <p className="text-xs text-muted-foreground truncate">{wf.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/workflow/${wf.id}/edit`);
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleting === wf.id}
                  onClick={(e) => handleDeleteClick(e, wf)}
                >
                  {deleting === wf.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5 h-8"
                  disabled={running === wf.id}
                  onClick={(e) => handleRun(e, wf.id)}
                >
                  {running === wf.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {t("workflow.run", "运行")}
                </Button>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={[10, 20, 30]}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-muted-foreground glass px-4 py-2 rounded-full">
          {t(
            "workflow.tip",
            "使用可视化编辑器拖拽创建工作流，或使用 CLI: npx mozi create workflow",
          )}
        </p>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <button
            onClick={() => setDeleteTarget(null)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workflow.deleteConfirmTitle", "确认删除")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "workflow.deleteConfirmDesc",
                `确定要删除工作流「${deleteTarget?.name ?? ""}」吗？此操作不可撤销，所有版本和运行记录将被永久删除。`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              {t("common.delete", "删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
