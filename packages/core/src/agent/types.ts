export enum AgentStatus {
  IDLE = "idle",
  PLANNING = "planning",
  EXECUTING = "executing",
  WAITING = "waiting",
  COMPLETED = "completed",
  FAILED = "failed",
  STOPPED = "stopped",
}

export interface AgentMeta {
  id: string;
  name: string;
  description?: string;
  version?: string;
  maxSteps: number;
  model?: string;
  tags?: string[];
}

export interface AgentStep {
  stepId: number;
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
  timestamp: number;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface AgentMemory {
  add(entry: { role: "system" | "user" | "assistant"; content: string }): void;
  getAll(): Array<{ role: string; content: string }>;
  clear(): void;
  summary(): string;
}

export interface AgentConfig {
  meta: AgentMeta;
  tools?: AgentTool[];
  systemPrompt?: string;
  onStep?: (step: AgentStep) => void;
  onComplete?: (result: AgentRunResult) => void;
  onError?: (error: Error) => void;
}

export interface AgentRunResult {
  agentId: string;
  runId: string;
  status: AgentStatus;
  steps: AgentStep[];
  output?: unknown;
  error?: Error;
  startedAt: number;
  completedAt: number;
  totalSteps: number;
}

export interface Agent {
  readonly meta: AgentMeta;
  readonly status: AgentStatus;
  run(goal: string, params?: Record<string, unknown>): Promise<AgentRunResult>;
  step(): Promise<AgentStep>;
  stop(): void;
  reset(): void;
  addTool(tool: AgentTool): void;
  removeTool(name: string): void;
  getHistory(): AgentStep[];
}

export interface AgentBlueprint {
  type: string;
  config: Omit<AgentConfig, "meta"> & { meta?: Partial<AgentMeta> };
}
