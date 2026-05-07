import type { TFunction } from "i18next";
import type { AgentRunStreamEvent } from "@/services/agentRunStream";

export type LiveFoldState = {
  meta: string;
  phases: string;
  answer: string;
  tools: string;
};

export function initialLiveFoldState(): LiveFoldState {
  return { meta: "", phases: "", answer: "", tools: "" };
}

function phaseLine(ev: AgentRunStreamEvent, t: TFunction): string {
  const ph = ev.phase;
  if (!ph) return "";
  if (ph === "starting") return t("agent.runPhaseStarting");
  if (ph === "context_ready") return t("agent.runPhaseContext");
  if (ph === "tools_loaded") return t("agent.runPhaseTools", { count: ev.tool_count ?? 0 });
  return ph;
}

function fenceRaw(body: string): string {
  return `\`\`\`\n${body}\n\`\`\``;
}

function formatToolBlock(tool: string, input: string, output: string): string {
  const ti = input.length > 4000 ? `${input.slice(0, 4000)}\n…` : input;
  const to = output.length > 8000 ? `${output.slice(0, 8000)}\n…` : output;
  return `#### \`${tool}\`\n\n**Input**\n\n${fenceRaw(ti)}\n\n**Output**\n\n${fenceRaw(to)}`;
}

export function applyStreamToLiveState(
  state: LiveFoldState,
  ev: AgentRunStreamEvent,
  pendingTool: { tool: string; input: string } | null,
  t: TFunction,
): { state: LiveFoldState; pendingTool: { tool: string; input: string } | null } {
  const next: LiveFoldState = { ...state };
  let pend = pendingTool;

  switch (ev.type) {
    case "meta": {
      /* Live stream UI: omit model/goal — only tool-related status is shown during the run. */
      break;
    }
    case "phase": {
      if (ev.phase !== "tools_loaded") break;
      const line = phaseLine(ev, t);
      if (line) next.phases = next.phases ? `${next.phases}\n- ${line}` : `- ${line}`;
      break;
    }
    case "llm_delta":
      next.answer += ev.text ?? "";
      break;
    case "tool_start":
      pend = { tool: ev.tool ?? "", input: (ev.input ?? "").slice(0, 4000) };
      break;
    case "tool_end": {
      const name = ev.tool ?? "";
      const tin = pend?.tool === name ? pend.input : "";
      const block = formatToolBlock(name, tin, ev.output ?? "");
      next.tools = next.tools ? `${next.tools}\n\n${block}` : block;
      pend = null;
      break;
    }
    default:
      break;
  }
  return { state: next, pendingTool: pend };
}

export function liveFoldToMarkdown(state: LiveFoldState, t: TFunction): string {
  const parts: string[] = [];
  if (state.phases.trim()) parts.push(`### ${t("agent.runLiveStatus")}\n\n${state.phases.trim()}`);
  const hasMetaOrPhases = !!state.phases.trim();
  if (state.answer.trim()) {
    parts.push(state.answer.trim());
  } else if (!hasMetaOrPhases) {
    parts.push(t("agent.runLiveStarting"));
  } else {
    parts.push(`_${t("agent.runLiveThinking")}_`);
  }
  let s = parts.join("\n\n");
  if (state.tools.trim()) {
    s += `\n\n---\n\n### ${t("agent.runToolSection")}\n\n${state.tools}`;
  }
  return s;
}
