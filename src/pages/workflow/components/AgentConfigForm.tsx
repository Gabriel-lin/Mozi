import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, X } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ConfigField } from "./ConfigField";
import { ImeInput } from "./ImeInput";
import { cn } from "@/lib/utils";

interface AgentConfigFormProps {
  node: Node;
  nodes: Node[];
  onPreview: (id: string, updates: Record<string, unknown>) => void;
  onConfirm: () => void;
}

function getData(node: Node) {
  return (node.data ?? {}) as Record<string, unknown>;
}

function getLLMNodes(nodes: Node[]): { id: string; label: string }[] {
  return nodes
    .filter((n) => (n.data as Record<string, unknown>)?.nodeKind === "llm")
    .map((n) => ({
      id: n.id,
      label: String((n.data as Record<string, unknown>)?.label ?? n.id),
    }));
}

function TagList({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) {
      onAdd(v);
      setDraft("");
    }
  };

  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
            >
              {item}
              <button onClick={() => onRemove(i)} className="hover:text-foreground ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <ImeInput
          value={draft}
          onValueChange={setDraft}
          className="h-7 text-xs flex-1"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function AgentConfigForm({ node, nodes, onPreview, onConfirm }: AgentConfigFormProps) {
  const { t } = useTranslation();
  const d = getData(node);
  const graphLabel = String(d.label ?? "Agent");

  const [label, setLabel] = useState(graphLabel);
  // 画布 inline 编辑后，`graphLabel` 会变化，需要同步到本地表单状态。
  // 使用 "adjust state while rendering" 模式代替 useEffect + setState。
  const [trackedGraphLabel, setTrackedGraphLabel] = useState(graphLabel);
  if (graphLabel !== trackedGraphLabel) {
    setTrackedGraphLabel(graphLabel);
    setLabel(graphLabel);
  }
  const [llmNodeId, setLlmNodeId] = useState(String(d.llmNodeId ?? ""));
  const [systemPrompt, setSystemPrompt] = useState(String(d.systemPrompt ?? ""));
  const [userPrompt, setUserPrompt] = useState(String(d.userPrompt ?? ""));
  const [rules, setRules] = useState<string[]>(() => {
    const r = d.rules;
    return Array.isArray(r) ? (r as string[]) : [];
  });
  const [hooks, setHooks] = useState<string[]>(() => {
    const h = d.hooks;
    return Array.isArray(h) ? (h as string[]) : [];
  });
  const [plugins, setPlugins] = useState<string[]>(() => {
    const p = d.plugins;
    return Array.isArray(p) ? (p as string[]) : [];
  });
  const [skills, setSkills] = useState<string[]>(() => {
    const s = d.skills;
    return Array.isArray(s) ? (s as string[]) : [];
  });

  const llmNodes = useMemo(() => getLLMNodes(nodes), [nodes]);

  const updates = useMemo(
    () => ({
      label,
      llmNodeId: llmNodeId || undefined,
      systemPrompt,
      userPrompt,
      rules,
      hooks,
      plugins,
      skills,
    }),
    [label, llmNodeId, systemPrompt, userPrompt, rules, hooks, plugins, skills],
  );

  useEffect(() => {
    onPreview(node.id, updates);
  }, [node.id, updates, onPreview]);

  const addItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => [...prev, v]);
  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (idx: number) =>
    setter((prev) => prev.filter((_, i) => i !== idx));

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <ConfigField label={t("workflow.nodeLabel", "标签")}>
          <ImeInput value={label} onValueChange={setLabel} className="h-8 text-xs" />
        </ConfigField>

        {/* LLM reference */}
        <ConfigField label="LLM 节点">
          {llmNodes.length > 0 ? (
            <div className="flex flex-col gap-1">
              {llmNodes.map((llm) => (
                <button
                  key={llm.id}
                  onClick={() => setLlmNodeId(llm.id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 h-8 text-xs rounded-md border transition-colors text-left",
                    llmNodeId === llm.id
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border/50 text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{llm.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">
              画布中无 LLM 节点，请先添加
            </span>
          )}
        </ConfigField>

        {/* System prompt */}
        <ConfigField label="系统提示词">
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[60px] text-xs resize-y"
            placeholder="你是一个有帮助的助手..."
          />
        </ConfigField>

        {/* User prompt */}
        <ConfigField label="用户提示词">
          <Textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            className="min-h-[48px] text-xs resize-y"
            placeholder="支持 {{input}} 变量模板"
          />
        </ConfigField>

        {/* Rules */}
        <ConfigField label="规则">
          <TagList
            items={rules}
            onAdd={addItem(setRules)}
            onRemove={removeItem(setRules)}
            placeholder="添加规则"
          />
        </ConfigField>

        {/* Hooks */}
        <ConfigField label="Hook">
          <TagList
            items={hooks}
            onAdd={addItem(setHooks)}
            onRemove={removeItem(setHooks)}
            placeholder="添加 Hook"
          />
        </ConfigField>

        {/* Plugins */}
        <ConfigField label="插件">
          <TagList
            items={plugins}
            onAdd={addItem(setPlugins)}
            onRemove={removeItem(setPlugins)}
            placeholder="添加插件"
          />
        </ConfigField>

        {/* Skills */}
        <ConfigField label="Skills">
          <TagList
            items={skills}
            onAdd={addItem(setSkills)}
            onRemove={removeItem(setSkills)}
            placeholder="添加 Skill"
          />
        </ConfigField>
      </div>

      <SheetFooter className="p-3 border-t border-border/30">
        <Button
          size="sm"
          className="ml-auto gap-1.5 h-8"
          onClick={useCallback(() => onConfirm(), [onConfirm])}
        >
          <Check className="h-3.5 w-3.5" />
          {t("common.confirm", "确认")}
        </Button>
      </SheetFooter>
    </>
  );
}
