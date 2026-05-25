import type { AppendMessage, ThreadUserMessagePart } from "@assistant-ui/react";
import type { RunAttachmentIn } from "@/services/agent";

const PART_CAP = 50_000;

function textFromContent(content: AppendMessage["content"]): string {
  if (typeof content === "string") return content;
  const textParts = content.filter(
    (p): p is Extract<(typeof content)[number], { type: "text" }> => p.type === "text",
  );
  return textParts
    .map((p) => p.text)
    .join("\n\n")
    .trim();
}

function partToPlain(part: ThreadUserMessagePart): string {
  if (part.type === "text") return part.text;
  if (part.type === "file")
    return `[File: ${part.filename ?? "file"}]\n${String(part.data).slice(0, PART_CAP)}`;
  if (part.type === "image")
    return `[Image: ${part.filename ?? "image"}]\n${String(part.image).slice(0, PART_CAP)}`;
  return "";
}

/** Text goal + attachment payloads for `POST /agents/{id}/run`. */
export function appendMessageToRunPayload(message: AppendMessage): {
  goal: string;
  attachments: RunAttachmentIn[];
} {
  const goal = textFromContent(message.content);
  const attachments: RunAttachmentIn[] = [];
  for (const att of message.attachments ?? []) {
    const chunks = att.content.map(partToPlain).filter(Boolean);
    attachments.push({
      name: att.name,
      mime_type: att.contentType ?? undefined,
      text: chunks.join("\n\n").slice(0, 120_000) || undefined,
    });
  }
  const effectiveGoal = goal.trim() || (attachments.length ? "(Files attached — see below.)" : "");
  return { goal: effectiveGoal, attachments };
}
