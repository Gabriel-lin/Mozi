import type {
  ExportedMessageRepository,
  ThreadMessage,
  ThreadUserMessagePart,
} from "@assistant-ui/react";
import type { RunAttachmentIn } from "@/services/agent";

/**
 * Server-side conversation persistence for agent runs.
 *
 * Aligns with assistant-ui’s branching model (same primitives as the docs
 * “shadcn” example: https://github.com/assistant-ui/assistant-ui/blob/main/apps/docs/components/examples/shadcn.tsx ):
 * we store `runtime.thread.export()` as `tree` plus a `linear` snapshot for the worker.
 */

/** Same shape as thread rows in `useAgentRunRuntime` (persisted + restored). */
export type AgentRunMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  runId?: string;
  feedback?: "positive" | "negative";
  userParts?: readonly ThreadUserMessagePart[];
  runAttachments?: RunAttachmentIn[];
};

export const CONVERSATION_V2 = 2 as const;

export type ConversationV2Payload = {
  v: typeof CONVERSATION_V2;
  linear: Record<string, unknown>[];
  tree: ExportedMessageRepository;
};

function textFromThreadMessage(m: ThreadMessage): string {
  if (typeof m.content === "string") return m.content;
  return m.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");
}

function userPartsFromThreadMessage(m: ThreadMessage): readonly ThreadUserMessagePart[] | undefined {
  if (m.role !== "user" || typeof m.content === "string") return undefined;
  const allowed = new Set(["text", "file", "image", "audio", "data"]);
  const parts = m.content.filter((p) => allowed.has(p.type)) as ThreadUserMessagePart[];
  return parts.length ? parts : undefined;
}

export function threadMessageToAgentRun(m: ThreadMessage, runRowId: string): AgentRunMessage {
  const text = textFromThreadMessage(m);
  const custom = m.metadata?.custom as Record<string, unknown> | undefined;
  const ridRaw = custom?.runId;
  const runId =
    m.role === "assistant"
      ? typeof ridRaw === "string" && ridRaw.trim()
        ? ridRaw
        : runRowId
      : typeof ridRaw === "string" && ridRaw.trim()
        ? ridRaw
        : undefined;
  const fb = m.metadata?.submittedFeedback?.type;
  const feedback = fb === "positive" || fb === "negative" ? fb : undefined;
  const userParts = m.role === "user" ? userPartsFromThreadMessage(m) : undefined;
  const row: AgentRunMessage = {
    id: m.id,
    role: m.role as "user" | "assistant",
    text,
    ...(runId ? { runId } : {}),
    ...(feedback ? { feedback } : {}),
    ...(userParts?.length ? { userParts } : {}),
  };
  return row;
}

/** Active branch root → leaf from an exported assistant-ui repository. */
export function linearMessagesFromExport(
  exp: ExportedMessageRepository,
  runRowId: string,
): AgentRunMessage[] {
  if (!exp.headId || !Array.isArray(exp.messages) || exp.messages.length === 0) return [];
  const byId = new Map(exp.messages.map((row) => [row.message.id, row]));
  const chain: (typeof exp.messages)[number][] = [];
  let curId: string | null = exp.headId;
  while (curId) {
    const row = byId.get(curId);
    if (!row) break;
    chain.unshift(row);
    curId = row.parentId;
  }
  return chain.map(({ message }) => threadMessageToAgentRun(message, runRowId));
}

export function serializeConversationMessages(
  msgs: readonly AgentRunMessage[],
  canonicalRunId: string,
): Record<string, unknown>[] {
  return msgs.map((m) => {
    const o: Record<string, unknown> = { id: m.id, role: m.role, text: m.text };
    if (m.role === "assistant") {
      o.runId = m.runId ?? canonicalRunId;
    } else if (m.runId) {
      o.runId = m.runId;
    }
    if (m.feedback) o.feedback = m.feedback;
    if (m.userParts?.length) o.userParts = m.userParts;
    if (m.runAttachments?.length) o.runAttachments = m.runAttachments;
    return o;
  });
}

export function deserializeConversation(raw: unknown, runRowId: string): AgentRunMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentRunMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : null;
    const role = o.role === "user" || o.role === "assistant" ? o.role : null;
    const text = typeof o.text === "string" ? o.text : "";
    if (!id || !role) continue;
    const ridRaw = o.runId ?? o.run_id;
    const runId =
      role === "assistant"
        ? typeof ridRaw === "string" && ridRaw.trim()
          ? ridRaw
          : runRowId
        : typeof ridRaw === "string" && ridRaw.trim()
          ? ridRaw
          : undefined;
    const feedback =
      o.feedback === "positive" || o.feedback === "negative" ? o.feedback : undefined;
    const userParts = Array.isArray(o.userParts)
      ? (o.userParts as ThreadUserMessagePart[])
      : Array.isArray(o.user_parts)
        ? (o.user_parts as ThreadUserMessagePart[])
        : undefined;
    const runAttachments = Array.isArray(o.runAttachments)
      ? (o.runAttachments as RunAttachmentIn[])
      : Array.isArray(o.run_attachments)
        ? (o.run_attachments as RunAttachmentIn[])
        : undefined;
    out.push({
      id,
      role,
      text,
      ...(runId ? { runId } : {}),
      ...(feedback ? { feedback } : {}),
      ...(userParts?.length ? { userParts } : {}),
      ...(runAttachments?.length ? { runAttachments } : {}),
    });
  }
  return out;
}

export type ParsedConversation = {
  linear: AgentRunMessage[];
  tree: ExportedMessageRepository | null;
};

export function parseLoadedConversation(raw: unknown, runRowId: string): ParsedConversation {
  if (raw == null) return { linear: [], tree: null };
  if (Array.isArray(raw)) {
    return { linear: deserializeConversation(raw, runRowId), tree: null };
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (o.v === CONVERSATION_V2 && o.tree && typeof o.tree === "object") {
      const tree = o.tree as ExportedMessageRepository;
      const linearRaw = o.linear;
      const linear = Array.isArray(linearRaw)
        ? deserializeConversation(linearRaw, runRowId)
        : linearMessagesFromExport(tree, runRowId);
      return { linear, tree };
    }
    if (Array.isArray(o.linear)) {
      return { linear: deserializeConversation(o.linear, runRowId), tree: null };
    }
  }
  return { linear: [], tree: null };
}

export function buildConversationPatchBody(
  runId: string,
  exported: ExportedMessageRepository,
): ConversationV2Payload | Record<string, unknown>[] {
  const linear = linearMessagesFromExport(exported, runId);
  const tree = JSON.parse(JSON.stringify(exported)) as ExportedMessageRepository;
  return {
    v: CONVERSATION_V2,
    linear: serializeConversationMessages(linear, runId),
    tree,
  };
}

/** Ordered user message ids from root → leaf on the current head path (for branch UX). */
export function userChainFromHead(exp: ExportedMessageRepository): string[] {
  const headId = exp.headId;
  if (!headId || !Array.isArray(exp.messages) || exp.messages.length === 0) return [];
  const byId = new Map(exp.messages.map((row) => [row.message.id, row]));
  const leafToRoot: string[] = [];
  let cur: string | null = headId;
  while (cur) {
    const row = byId.get(cur);
    if (!row) break;
    if (row.message.role === "user") leafToRoot.push(cur);
    cur = row.parentId;
  }
  leafToRoot.reverse();
  return leafToRoot;
}

/**
 * After a **user** BranchPicker change, align every user→assistant step on the head path so the
 * assistant is the latest sibling under that user (`messages` order ≈ append / regenerate order).
 * Scans from the rootmost pair on the path toward the leaf and repeats until stable, so earlier
 * turns are fixed before later ones.
 * When only the **assistant** BranchPicker moves, `userChainFromHead` is unchanged and callers skip this.
 */
export function preferLatestAssistantOnPath(exp: ExportedMessageRepository): ExportedMessageRepository {
  let repo = exp;
  for (let guard = 0; guard < 24; guard++) {
    const headId = repo.headId;
    if (!headId || !Array.isArray(repo.messages) || repo.messages.length === 0) return repo;

    const messages = repo.messages;
    const byId = new Map(messages.map((r) => [r.message.id, r]));
    const rowIndex = (row: (typeof messages)[number]) => messages.indexOf(row);

    function latestAssistantChildId(userId: string): string | null {
      const assistants = messages.filter(
        (r) => r.parentId === userId && r.message.role === "assistant",
      );
      if (assistants.length <= 1) return null;
      let best = assistants[0]!;
      for (const a of assistants) {
        if (rowIndex(a) > rowIndex(best)) best = a;
      }
      return best.message.id;
    }

    function deepestLeafPreferLastInExport(startId: string): string {
      let cur = startId;
      while (true) {
        const kids = messages.filter((r) => r.parentId === cur);
        if (kids.length === 0) return cur;
        let best = kids[0]!;
        for (const k of kids) {
          if (rowIndex(k) > rowIndex(best)) best = k;
        }
        cur = best.message.id;
      }
    }

    const path: string[] = [];
    let cur: string | null = headId;
    while (cur) {
      path.push(cur);
      cur = byId.get(cur)?.parentId ?? null;
    }

    let newHead: string | null = null;
    for (let i = path.length - 2; i >= 0; i--) {
      const childId = path[i]!;
      const parentId = path[i + 1]!;
      const parentRow = byId.get(parentId);
      const childRow = byId.get(childId);
      if (!parentRow || parentRow.message.role !== "user") continue;
      if (!childRow || childRow.message.role !== "assistant") continue;

      const latest = latestAssistantChildId(parentId);
      if (!latest || latest === childId) continue;

      newHead = deepestLeafPreferLastInExport(latest);
      break;
    }

    if (!newHead || newHead === headId) return repo;
    repo = { ...repo, headId: newHead };
  }
  return repo;
}
