import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { workflowApi } from "@/services/workflow";
import { workspaceApi } from "@/services/workspace";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitBranch, Workflow, Repeat, Shuffle, FileCode2, Sparkles } from "lucide-react";

type TemplateCategory = "blank" | "builtin";

interface TemplateItem {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
  gradient: string;
  category: TemplateCategory;
}

const templates: TemplateItem[] = [
  {
    id: "blank",
    icon: FileCode2,
    labelKey: "workflow.tplBlank",
    descKey: "workflow.tplBlankDesc",
    gradient: "from-zinc-400 to-zinc-500",
    category: "blank",
  },
  {
    id: "sequential",
    icon: Workflow,
    labelKey: "workflow.typeSequential",
    descKey: "workflow.tplSequentialDesc",
    gradient: "from-sky-400 to-blue-500",
    category: "builtin",
  },
  {
    id: "parallel",
    icon: Shuffle,
    labelKey: "workflow.typeParallel",
    descKey: "workflow.tplParallelDesc",
    gradient: "from-violet-400 to-purple-500",
    category: "builtin",
  },
  {
    id: "loop",
    icon: Repeat,
    labelKey: "workflow.typeLoop",
    descKey: "workflow.tplLoopDesc",
    gradient: "from-amber-400 to-orange-500",
    category: "builtin",
  },
];

function TemplateCard({
  item,
  selected,
  onSelect,
  t,
}: {
  item: TemplateItem;
  selected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all duration-200 ${
        selected
          ? "border-primary bg-accent/50 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-accent/30"
      }`}
    >
      <div className="flex items-center gap-3 w-full">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient} text-white shadow-sm`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">{t(item.labelKey, item.id)}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t(item.descKey, "")}</p>
      {selected && <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />}
    </button>
  );
}

export function WorkflowCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("blank");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    workspaceApi
      .list()
      .then((res) => {
        const first = res?.workspaces?.[0];
        if (first) setWorkspaceId(first.id);
      })
      .catch(() => {});
  }, []);

  const blankTemplates = templates.filter((tpl) => tpl.category === "blank");
  const builtinTemplates = templates.filter((tpl) => tpl.category === "builtin");

  const handleCreate = async () => {
    if (!name.trim() || !workspaceId || creating) return;
    try {
      setCreating(true);
      const wf = await workflowApi.create({
        name: name.trim(),
        workspace_id: workspaceId,
        tags: [selectedId],
      });
      navigate(`/workflow/${wf.id}/edit`);
    } catch {
      // TODO: toast error
    } finally {
      setCreating(false);
    }
  };

  return (
    <SubPageLayout
      titleKey="workflow.createTitle"
      descriptionKey="workflow.createDesc"
      icon={GitBranch}
      iconGradient="from-sky-400 to-indigo-500"
    >
      <div className="space-y-8">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("workflow.nameLabel", "工作流名称")}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("workflow.namePlaceholder", "输入工作流名称...")}
            className="max-w-md"
          />
        </div>

        {/* Blank template */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">
              {t("workflow.catBlank", "空白模板")}
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {blankTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                item={tpl}
                selected={selectedId === tpl.id}
                onSelect={() => setSelectedId(tpl.id)}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* Built-in templates */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">
              {t("workflow.catBuiltin", "内置模板")}
            </label>
            <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
              {builtinTemplates.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {builtinTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                item={tpl}
                selected={selectedId === tpl.id}
                onSelect={() => setSelectedId(tpl.id)}
                t={t}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button disabled={!name.trim() || creating} onClick={handleCreate}>
            {t("common.confirm", "创建")}
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            {t("common.cancel", "取消")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
