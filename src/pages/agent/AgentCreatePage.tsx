import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Sparkles, Cpu, MessageSquare } from "lucide-react";

const agentTypes = [
  {
    id: "react",
    icon: Sparkles,
    labelKey: "agent.typeReact",
    gradient: "from-emerald-400 to-teal-500",
  },
  { id: "chain", icon: Cpu, labelKey: "agent.typeChain", gradient: "from-blue-400 to-indigo-500" },
  {
    id: "chat",
    icon: MessageSquare,
    labelKey: "agent.typeChat",
    gradient: "from-violet-400 to-purple-500",
  },
] as const;

export function AgentCreatePage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("react");

  return (
    <SubPageLayout
      titleKey="agent.createTitle"
      descriptionKey="agent.createDesc"
      icon={Bot}
      iconGradient="from-emerald-400 to-teal-500"
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("agent.nameLabel", "智能体名称")}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("agent.namePlaceholder", "输入智能体名称...")}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("agent.typeLabel", "智能体类型")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {agentTypes.map(({ id, icon: Icon, labelKey, gradient }) => (
              <button
                key={id}
                onClick={() => setSelectedType(id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedType === id
                    ? "border-primary bg-accent/50"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-foreground">{t(labelKey, id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button disabled={!name.trim()}>{t("common.confirm", "创建")}</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            {t("common.cancel", "取消")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
