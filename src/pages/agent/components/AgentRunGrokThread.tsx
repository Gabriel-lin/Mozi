import type { FC } from "react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type ComposerState,
  type ThreadState,
} from "@assistant-ui/react";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  RefreshCw,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AgentRunModelSelectRow } from "@/pages/agent/hooks/useAgentRunRuntime";

export type AgentRunGrokThreadProps = {
  agentName: string | null;
  dictationSupported: boolean;
  /** LLM id for the next run — composed next to `ComposerPrimitive` (assistant-ui thread). */
  composerModel: string;
  onComposerModelChange: (model: string) => void;
  modelSelectRows: AgentRunModelSelectRow[];
  /** Mirrors agent edit page while provider models load from API. */
  modelsLoading?: boolean;
};

function auiThreadIsEmpty(s: unknown): boolean {
  const t = s as { thread?: { isEmpty?: boolean } };
  return Boolean(t.thread?.isEmpty);
}

export const AgentRunGrokThread: FC<AgentRunGrokThreadProps> = ({
  agentName,
  dictationSupported,
  composerModel,
  onComposerModelChange,
  modelSelectRows,
  modelsLoading = false,
}) => {
  const { t } = useTranslation();
  const threadViewportRef = useRef<HTMLDivElement>(null);
  const [scrollSnap, setScrollSnap] = useState({ canTop: false, canBottom: false });

  const syncViewportScroll = useCallback(() => {
    const el = threadViewportRef.current;
    if (!el) return;
    const slack = 8;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const canTop = scrollTop > slack;
    const canBottom = maxScroll > slack && scrollTop < maxScroll - slack;
    setScrollSnap((p) =>
      p.canTop === canTop && p.canBottom === canBottom ? p : { canTop, canBottom },
    );
  }, []);

  const hasThread = useAuiState((s) => !auiThreadIsEmpty(s));

  useLayoutEffect(() => {
    if (!hasThread) return;
    const el = threadViewportRef.current;
    if (!el) return;
    const runSync = () => syncViewportScroll();
    runSync();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(runSync);
    });
    el.addEventListener("scroll", runSync, { passive: true });
    const ro = new ResizeObserver(runSync);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      el.removeEventListener("scroll", runSync);
      ro.disconnect();
    };
  }, [hasThread, syncViewportScroll]);

  const scrollViewportTop = useCallback(() => {
    threadViewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollViewportBottom = useCallback(() => {
    const el = threadViewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  return (
    <ThreadPrimitive.Root
      className={cn("flex h-full min-h-0 flex-1 flex-col items-stretch text-foreground")}
    >
      <ThreadPrimitive.If empty>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% 20%, rgb(16 185 129 / 0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 80% 80%, rgb(20 184 166 / 0.12), transparent 50%)",
            }}
          />
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4">
            <div className="flex max-w-3xl flex-col items-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/90 to-teal-600 text-white shadow-lg ring-4 ring-emerald-500/15">
                <Bot className="h-7 w-7" aria-hidden />
              </div>
              {agentName ? (
                <p className="max-w-md text-center text-sm font-medium text-foreground/90">
                  {agentName}
                </p>
              ) : (
                <div className="h-4" />
              )}
            </div>
          </div>
          <div className="relative mt-auto w-full shrink-0 border-t border-border/60 bg-background/95 px-1 pb-1 pt-2 text-foreground backdrop-blur-sm sm:px-2">
            <AgentRunComposer
              dictationSupported={dictationSupported}
              composerModel={composerModel}
              onComposerModelChange={onComposerModelChange}
              modelSelectRows={modelSelectRows}
              modelsLoading={modelsLoading}
              className="mb-0"
            />
          </div>
        </div>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If empty={false}>
        <ThreadPrimitive.Viewport
          ref={threadViewportRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 pt-4 sm:px-2",
          )}
        >
          <ThreadPrimitive.Messages>
            {() => <AgentRunThreadMessage dictationSupported={dictationSupported} />}
          </ThreadPrimitive.Messages>
        </ThreadPrimitive.Viewport>
        <ThreadPrimitive.ViewportFooter
          className={cn(
            "sticky bottom-0 z-10 mt-auto flex flex-col border-t border-border/60 bg-background/95 px-1 pb-1 pt-2 text-foreground backdrop-blur-sm sm:px-2",
          )}
        >
          <div className="relative mx-auto w-full max-w-3xl px-4">
            <div className="pointer-events-none absolute -top-10 left-0 right-0 z-20 flex justify-center gap-1.5">
              <button
                type="button"
                onClick={scrollViewportTop}
                disabled={!scrollSnap.canTop}
                title={t("agent.runScrollToTop")}
                aria-label={t("agent.runScrollToTop")}
                className={cn(
                  "pointer-events-auto rounded-full border bg-background p-2 shadow-sm transition-opacity",
                  "border-border/70 hover:bg-muted/80 dark:border-white/15 dark:bg-[#2a2a2a]",
                  !scrollSnap.canTop && "cursor-default opacity-40",
                )}
              >
                <ChevronUp className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={scrollViewportBottom}
                disabled={!scrollSnap.canBottom}
                title={t("agent.runScrollToBottom")}
                aria-label={t("agent.runScrollToBottom")}
                className={cn(
                  "pointer-events-auto rounded-full border bg-background p-2 shadow-sm transition-opacity",
                  "border-border/70 hover:bg-muted/80 dark:border-white/15 dark:bg-[#2a2a2a]",
                  !scrollSnap.canBottom && "cursor-default opacity-40",
                )}
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <AgentRunComposer
              dictationSupported={dictationSupported}
              composerModel={composerModel}
              onComposerModelChange={onComposerModelChange}
              modelSelectRows={modelSelectRows}
              modelsLoading={modelsLoading}
              className="mx-0 max-w-none px-0"
            />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.If>
    </ThreadPrimitive.Root>
  );
};

function threadComposerSlice(s: unknown): {
  composer: Pick<ComposerState, "isEmpty">;
  thread: Pick<ThreadState, "isRunning">;
} {
  return s as {
    composer: Pick<ComposerState, "isEmpty">;
    thread: Pick<ThreadState, "isRunning">;
  };
}

const AgentRunComposer: FC<{
  dictationSupported: boolean;
  composerModel: string;
  onComposerModelChange: (model: string) => void;
  modelSelectRows: AgentRunModelSelectRow[];
  modelsLoading?: boolean;
  className?: string;
}> = ({
  dictationSupported,
  composerModel,
  onComposerModelChange,
  modelSelectRows,
  modelsLoading = false,
  className,
}) => {
  const { t } = useTranslation();
  const modelFieldId = useId();
  const isEmpty = useAuiState((s) => threadComposerSlice(s).composer.isEmpty);
  const isRunning = useAuiState((s) => threadComposerSlice(s).thread.isRunning);

  const modelSelectDisabled = isRunning || modelsLoading || modelSelectRows.length === 0;

  return (
    <ComposerPrimitive.Root
      className={cn("group/composer mx-auto mb-3 w-full max-w-3xl px-4", className)}
      data-empty={isEmpty}
      data-running={isRunning}
    >
      <ComposerPrimitive.AttachmentDropzone className="rounded-3xl">
        <div
          className={cn(
            "overflow-hidden rounded-3xl border border-border/70 bg-muted/30 shadow-sm ring-1 ring-border/35",
            "transition-shadow focus-within:border-emerald-500/35 focus-within:ring-emerald-500/25 focus-within:shadow-md",
            "dark:bg-muted/20",
          )}
        >
          <ComposerPrimitive.Attachments />
          <div className="flex items-center justify-end gap-2 border-b border-border/50 px-2.5 py-1">
            <label htmlFor={modelFieldId} className="shrink-0 text-xs text-muted-foreground">
              {t("agent.runModel")}
            </label>
            <Select
              value={composerModel}
              onValueChange={onComposerModelChange}
              disabled={modelSelectDisabled}
            >
              <SelectTrigger
                id={modelFieldId}
                aria-label={t("agent.runModel")}
                className="h-8 w-[min(100%,11rem)] border-border/60 bg-background/80 text-xs shadow-sm"
              >
                <div className="flex w-full min-w-0 items-center gap-2">
                  {modelsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : null}
                  <SelectValue
                    placeholder={
                      modelsLoading ? t("agent.modelLoading") : t("agent.modelPlaceholder")
                    }
                  />
                </div>
              </SelectTrigger>
              <SelectContent position="popper">
                {modelSelectRows.map((row) => (
                  <SelectItem key={row.value} value={row.value} className="text-xs">
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-0.5 px-1.5 pt-1.5">
            <ComposerPrimitive.DictationTranscript className="min-h-0 px-1 text-xs text-muted-foreground" />
          </div>
          <div className="flex min-h-12 items-end gap-1 px-1.5 py-1.5">
            <ComposerPrimitive.AddAttachment
              multiple
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
              )}
              aria-label={t("agent.runAddAttachment")}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </ComposerPrimitive.AddAttachment>
            {dictationSupported ? (
              <ComposerPrimitive.Dictate
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "data-[state=recording]:bg-destructive/15 data-[state=recording]:text-destructive",
                )}
                aria-label={t("agent.runDictate")}
              >
                <Mic className="h-3.5 w-3.5" />
              </ComposerPrimitive.Dictate>
            ) : null}
            <ComposerPrimitive.Input
              placeholder={t("agent.runComposerPlaceholder")}
              rows={1}
              className={cn(
                "my-1 max-h-40 min-h-5 min-w-0 flex-1 resize-none bg-transparent px-1 text-sm leading-5",
                "text-foreground outline-none placeholder:text-muted-foreground",
              )}
            />
            <div className="relative h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-2 ring-emerald-500/20 dark:from-emerald-600 dark:to-teal-700">
              <ComposerPrimitive.Send
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full transition-opacity duration-200",
                  "group-data-[running=true]/composer:pointer-events-none group-data-[running=true]/composer:opacity-0",
                )}
                aria-label={t("agent.send")}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </ComposerPrimitive.Send>
              <ComposerPrimitive.Cancel
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full transition-opacity duration-200",
                  "group-data-[running=false]/composer:pointer-events-none group-data-[running=false]/composer:opacity-0",
                )}
                aria-label={t("agent.stop")}
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              </ComposerPrimitive.Cancel>
            </div>
          </div>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

type PartRender = {
  part: {
    type: string;
    text?: string;
    image?: string;
    filename?: string;
    mimeType?: string;
    data?: string;
    status?: { type: string };
  };
};

type ScopedMessageState = {
  message: { role: "user" | "assistant" | "system" };
};

const AgentRunBranchPicker: FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "inline-flex items-center gap-0.5 font-semibold text-sm text-muted-foreground",
        className,
      )}
    >
      <BranchPickerPrimitive.Previous
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground disabled:opacity-40",
        )}
        title={t("agent.runBranchPrev")}
        aria-label={t("agent.runBranchPrev")}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </BranchPickerPrimitive.Previous>
      <span className="min-w-[2.25rem] px-1 text-center tabular-nums">
        <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground disabled:opacity-40",
        )}
        title={t("agent.runBranchNext")}
        aria-label={t("agent.runBranchNext")}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const AgentRunEditComposer: FC<{ dictationSupported: boolean }> = ({ dictationSupported }) => {
  const { t } = useTranslation();
  const isUser = useAuiState((s) => (s as unknown as ScopedMessageState).message.role === "user");

  return (
    <ComposerPrimitive.Root
      className={cn(
        "mx-auto mb-3 flex w-full max-w-3xl flex-col justify-end gap-1 rounded-3xl rounded-br-lg border border-border/70 px-4 py-3",
        "bg-muted/70 text-foreground shadow-sm dark:bg-muted/40",
      )}
    >
      {isUser ? (
        <>
          <ComposerPrimitive.Attachments />
          <div className="flex min-h-10 items-end gap-1 border-b border-border/40 pb-2">
            <ComposerPrimitive.AddAttachment
              multiple
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
              )}
              aria-label={t("agent.runAddAttachment")}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </ComposerPrimitive.AddAttachment>
            {dictationSupported ? (
              <ComposerPrimitive.Dictate
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "data-[state=recording]:bg-destructive/15 data-[state=recording]:text-destructive",
                )}
                aria-label={t("agent.runDictate")}
              >
                <Mic className="h-3.5 w-3.5" />
              </ComposerPrimitive.Dictate>
            ) : null}
          </div>
        </>
      ) : null}
      <ComposerPrimitive.Input
        rows={isUser ? 3 : 8}
        placeholder={t("agent.runComposerPlaceholder")}
        className={cn(
          "mt-1 min-h-8 w-full resize-none bg-transparent px-1 py-2 text-sm leading-5 outline-none",
          "text-foreground placeholder:text-muted-foreground",
        )}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <ComposerPrimitive.Cancel
          className={cn(
            "rounded-full bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors",
            "hover:bg-muted dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800",
          )}
        >
          {t("common.cancel")}
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send
          className={cn(
            "rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity",
            "hover:opacity-90 dark:from-emerald-600 dark:to-teal-700",
          )}
          aria-label={t("agent.send")}
        >
          {t("agent.send")}
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AgentRunUserMessage: FC = () => {
  const { t } = useTranslation();
  return (
    <MessagePrimitive.Root className="group/message relative mx-auto mb-3 flex w-full max-w-3xl flex-col items-end px-4 pb-0.5">
      <AuiIf
        condition={(s) =>
          ((s as unknown as ScopedMessageState & { message: { attachments?: unknown[] } }).message
            .attachments?.length ?? 0) > 0
        }
      >
        <div className="mb-1 flex w-full max-w-[min(100%,42rem)] flex-row flex-wrap justify-end gap-2">
          <MessagePrimitive.Attachments />
        </div>
      </AuiIf>

      <div
        className={cn(
          "relative max-w-[min(100%,42rem)] rounded-3xl rounded-br-lg border border-border/70",
          "bg-muted/70 px-4 py-3 text-foreground shadow-sm dark:bg-muted/40",
        )}
      >
        <div className="space-y-2">
          <MessagePrimitive.Parts>
            {(props: PartRender) => {
              const { part } = props;
              if (part.type === "text") {
                return (
                  <div className="prose prose-sm dark:prose-invert wrap-break-word prose-p:my-0">
                    <MarkdownText />
                  </div>
                );
              }
              if (part.type === "image" && part.image) {
                return (
                  <img
                    src={part.image}
                    alt=""
                    className="max-h-56 max-w-full rounded-lg border border-border/60 object-contain"
                  />
                );
              }
              if (part.type === "file" && (part.data || part.filename)) {
                const name = part.filename || "file";
                const raw = part.data ?? "";
                const href = raw.startsWith("data:")
                  ? raw
                  : part.mimeType
                    ? `data:${part.mimeType};base64,${raw}`
                    : undefined;
                return href ? (
                  <a
                    href={href}
                    download={name}
                    className="block truncate text-sm font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                  >
                    {name}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">{name}</span>
                );
              }
              return null;
            }}
          </MessagePrimitive.Parts>
        </div>
      </div>

      <div className="mt-1 flex h-8 items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
        <ActionBarPrimitive.Root
          hideWhenRunning
          autohide="not-last"
          autohideFloat="single-branch"
          className="flex items-center gap-0.5"
        >
          <ActionBarPrimitive.Edit
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
            )}
            aria-label={t("agent.runEditResend")}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </ActionBarPrimitive.Edit>
          <ActionBarPrimitive.Copy
            className={cn(
              "relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
            )}
            aria-label={t("menu.copy")}
          >
            <AuiIf
              condition={(s) =>
                (s as unknown as { message: { isCopied?: boolean } }).message.isCopied === true
              }
            >
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </AuiIf>
            <AuiIf
              condition={(s) =>
                (s as unknown as { message: { isCopied?: boolean } }).message.isCopied !== true
              }
            >
              <Copy className="h-4 w-4" aria-hidden />
            </AuiIf>
          </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>
      </div>

      <AgentRunBranchPicker className="mt-2 mr-1 self-end" />
    </MessagePrimitive.Root>
  );
};

const AgentRunAssistantMessage: FC = () => {
  const { t } = useTranslation();
  return (
    <MessagePrimitive.Root className="relative mx-auto mb-3 flex w-full max-w-3xl gap-3 px-4">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-border/70",
          "bg-gradient-to-br from-emerald-400/90 to-teal-600 text-white shadow-sm ring-1 ring-emerald-500/15",
        )}
        aria-hidden
      >
        <Bot className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={cn(
            "prose prose-sm max-w-none wrap-break-word dark:prose-invert",
            "prose-li:my-1 prose-ol:my-1 prose-p:my-2 prose-ul:my-1 text-foreground",
          )}
        >
          <MessagePrimitive.Parts>
            {(props: PartRender) => {
              const { part } = props;
              if (part.type === "text") {
                if (part.status?.type === "running" && part.text === "") {
                  return (
                    <span className="inline-block animate-pulse text-sm text-muted-foreground">
                      …
                    </span>
                  );
                }
                return <MarkdownText />;
              }
              return null;
            }}
          </MessagePrimitive.Parts>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AgentRunBranchPicker />

          <ActionBarPrimitive.Root
            hideWhenRunning
            autohide="not-last"
            autohideFloat="single-branch"
            className={cn(
              "flex items-center gap-0.5 rounded-lg",
              "data-floating:absolute data-floating:border-2 data-floating:border-border/60 data-floating:bg-background/95 data-floating:p-1 data-floating:shadow-sm",
            )}
          >
            <ActionBarPrimitive.FeedbackPositive
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-emerald-600 dark:hover:text-emerald-400",
              )}
              aria-label={t("agent.runFeedbackUp")}
            >
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
            </ActionBarPrimitive.FeedbackPositive>
            <ActionBarPrimitive.FeedbackNegative
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-destructive",
              )}
              aria-label={t("agent.runFeedbackDown")}
            >
              <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
            </ActionBarPrimitive.FeedbackNegative>
            <ActionBarPrimitive.Reload
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
              )}
              aria-label={t("agent.runRegenerate")}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </ActionBarPrimitive.Reload>
            <ActionBarPrimitive.Copy
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
              )}
              aria-label={t("menu.copy")}
            >
              <AuiIf
                condition={(s) =>
                  (s as unknown as { message: { isCopied?: boolean } }).message.isCopied === true
                }
              >
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </AuiIf>
              <AuiIf
                condition={(s) =>
                  (s as unknown as { message: { isCopied?: boolean } }).message.isCopied !== true
                }
              >
                <Copy className="h-4 w-4" aria-hidden />
              </AuiIf>
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

/** Resolve editing vs role using reactive store — `ThreadPrimitive.Messages` callback `message` is not reactive. */
const AgentRunThreadMessage: FC<{ dictationSupported: boolean }> = ({ dictationSupported }) => {
  const isEditing = useAuiState(
    (s) =>
      (s as unknown as { message: { composer: { isEditing: boolean } } }).message.composer
        .isEditing,
  );
  const role = useAuiState((s) => (s as unknown as ScopedMessageState).message.role);
  if (isEditing) {
    return <AgentRunEditComposer dictationSupported={dictationSupported} />;
  }
  if (role === "user") {
    return <AgentRunUserMessage />;
  }
  return <AgentRunAssistantMessage />;
};
