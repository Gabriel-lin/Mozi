import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { ConfigField } from "./ConfigField";
import { ImeInput } from "./ImeInput";

interface NodeConfigFormProps {
  node: Node;
  onPreview: (id: string, updates: Record<string, unknown>) => void;
  onConfirm: () => void;
}

export function NodeConfigForm({ node, onPreview, onConfirm }: NodeConfigFormProps) {
  const { t } = useTranslation();
  const isTextNode = node.type === "workflowText";
  const fieldKey = isTextNode ? "text" : "label";
  const [label, setLabel] = useState(
    String((node.data as Record<string, unknown>)?.[fieldKey] ?? ""),
  );

  useEffect(() => {
    onPreview(node.id, { [fieldKey]: label });
  }, [label, node.id, fieldKey, onPreview]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <ConfigField label={t("workflow.nodeLabel", "标签")}>
          <ImeInput value={label} onValueChange={setLabel} className="h-8 text-xs" />
        </ConfigField>
        <ConfigField label={t("workflow.position", "位置")}>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] text-muted-foreground">X</span>
              <Input
                value={Math.round(node.position.x)}
                readOnly
                className="h-7 text-xs font-mono bg-muted/40"
              />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[10px] text-muted-foreground">Y</span>
              <Input
                value={Math.round(node.position.y)}
                readOnly
                className="h-7 text-xs font-mono bg-muted/40"
              />
            </div>
          </div>
        </ConfigField>
      </div>
      <SheetFooter className="p-3 border-t border-border/30">
        <Button size="sm" className="ml-auto gap-1.5 h-8" onClick={handleConfirm}>
          <Check className="h-3.5 w-3.5" />
          {t("common.confirm", "确认")}
        </Button>
      </SheetFooter>
    </>
  );
}
