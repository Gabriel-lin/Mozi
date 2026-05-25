import { AGENT_PROVIDER_IDS, type AgentProviderId } from "./agentLlm";

export type AgentUiType = "react" | "chain" | "chat";

export function parseAgentType(config: Record<string, unknown> | undefined): AgentUiType {
  const raw = String(config?.agent_type ?? "react").toLowerCase();
  if (raw === "chain" || raw === "chat") return raw;
  return "react";
}

export function parseLlmProvider(config: Record<string, unknown> | undefined): string {
  return String(config?.llm_provider ?? "openai");
}

export function coerceAgentProviderId(raw: string): AgentProviderId {
  return (AGENT_PROVIDER_IDS as readonly string[]).includes(raw)
    ? (raw as AgentProviderId)
    : "openai";
}
