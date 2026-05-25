import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AgentSkillSourceItem } from "@/services/agent";

type LocalSkillItemTauri = {
  id: string;
  label: string;
  sources: string[];
};

function toAgentItem(r: LocalSkillItemTauri): AgentSkillSourceItem {
  const sources: ("mozi" | "agents" | "config")[] = [];
  for (const s of r.sources) {
    if (s === "mozi" || s === "agents" || s === "config") {
      if (!sources.includes(s)) sources.push(s);
    }
  }
  if (sources.length === 0) {
    sources.push("mozi");
  }
  return { id: r.id, label: r.label, sources };
}

/**
 * Tauri: list skill folders under the *real* user home (`~/.Mozi/skills`, `~/.agents/skills`).
 * Returns `null` in the browser or on invoke failure.
 */
export async function listLocalAgentSkillsFromTauri(): Promise<AgentSkillSourceItem[] | null> {
  if (!isTauri()) return null;
  try {
    const items = await invoke<LocalSkillItemTauri[]>("list_local_agent_skills");
    return items.map(toAgentItem);
  } catch {
    return null;
  }
}

/**
 * Merges API `items` (server-side discovery) with the Tauri list.
 * Same `id`: label prefers the longer string; `sources` are unioned and sorted: config, agents, mozi.
 */
export function mergeSkillCatalogItems(
  fromApi: AgentSkillSourceItem[],
  fromTauri: AgentSkillSourceItem[] | null,
): AgentSkillSourceItem[] {
  if (!fromTauri || fromTauri.length === 0) return fromApi;

  const order: Record<"config" | "agents" | "mozi", number> = { config: 0, agents: 1, mozi: 2 };
  const mergeOne = (a: AgentSkillSourceItem, b: AgentSkillSourceItem): AgentSkillSourceItem => {
    const label = (a.label?.length ?? 0) >= (b.label?.length ?? 0) ? a.label : b.label;
    const srcs = new Set<"config" | "agents" | "mozi">([...a.sources, ...b.sources]);
    const sources = Array.from(srcs).sort((x, y) => order[x] - order[y]);
    return { id: a.id, label, sources };
  };

  const byId = new Map<string, AgentSkillSourceItem>();
  for (const x of fromApi) {
    byId.set(x.id, { ...x, sources: [...x.sources] });
  }
  for (const x of fromTauri) {
    const e = byId.get(x.id);
    if (e) {
      byId.set(x.id, mergeOne(e, x));
    } else {
      byId.set(x.id, { ...x, sources: [...x.sources] });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}
