import React from "react";

interface ConfigFieldProps {
  label: string;
  children: React.ReactNode;
}

export function ConfigField({ label, children }: ConfigFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
