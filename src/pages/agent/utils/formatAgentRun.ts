import type { AgentRunStep, RunOut } from "@/services/agent";

const TERMINAL = new Set(["completed", "failed", "stopped"]);

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n… _(${s.length - max} more chars)_`;
}

/** Markdown body for an assistant message from a persisted or in-flight run. */
export function formatAgentRunMarkdown(run: RunOut): string {
  if (!TERMINAL.has(run.status)) {
    return `_… ${run.status}_`;
  }

  const chunks: string[] = [];
  const out = run.output;
  const answer =
    out &&
    typeof out === "object" &&
    out !== null &&
    "answer" in out &&
    typeof (out as { answer?: unknown }).answer === "string"
      ? (out as { answer: string }).answer
      : null;

  if (answer) chunks.push(answer);
  else if (run.error) chunks.push(`**Error**\n\n\`\`\`\n${run.error}\n\`\`\``);
  else if (run.status === "failed") chunks.push(run.error || "_Failed_");
  else if (run.status === "stopped") chunks.push("_Stopped_");

  const steps = run.steps as AgentRunStep[] | undefined;
  if (steps?.length) {
    chunks.push("\n\n---\n\n### Tools\n");
    for (const s of steps) {
      chunks.push(
        `\n#### \`${s.tool}\`\n\n**Input**\n\n\`\`\`\n${truncate(String(s.input ?? ""), 4000)}\n\`\`\`\n\n**Output**\n\n\`\`\`\n${truncate(String(s.output ?? ""), 8000)}\n\`\`\`\n`,
      );
    }
  }

  return chunks.join("\n").trim() || "_No output_";
}
