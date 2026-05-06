import type { ComponentProps } from "react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { cn } from "@/lib/utils";

export type MarkdownTextProps = ComponentProps<typeof MarkdownTextPrimitive>;

/** Renders the current text message part as Markdown (inside `MessagePrimitive.Parts`). */
export function MarkdownText({ className, ...props }: MarkdownTextProps) {
  return (
    <MarkdownTextPrimitive
      className={cn(
        "aui-md [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-muted/40 [&_pre]:p-3",
        className,
      )}
      {...props}
    />
  );
}
