export enum NodeType {
  TASK = "task",
  CONDITION = "condition",
  PARALLEL = "parallel",
  LOOP = "loop",
  SUB_WORKFLOW = "sub_workflow",
  START = "start",
  END = "end",
}

export enum NodeStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
  CANCELLED = "cancelled",
}

export enum WorkflowStatus {
  IDLE = "idle",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config?: Record<string, unknown>;
  handler?: NodeHandler;
  condition?: (ctx: WorkflowContext) => boolean | Promise<boolean>;
  retries?: number;
  timeoutMs?: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
  condition?: (ctx: WorkflowContext) => boolean | Promise<boolean>;
}

export interface WorkflowContext {
  workflowId: string;
  data: Record<string, unknown>;
  nodeResults: Map<string, NodeResult>;
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
}

export interface NodeResult {
  nodeId: string;
  status: NodeStatus;
  output?: unknown;
  error?: Error;
  startedAt: number;
  completedAt?: number;
  retryCount: number;
}

export type NodeHandler = (ctx: WorkflowContext, node: WorkflowNode) => unknown | Promise<unknown>;

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  timeout?: number;
}

export interface WorkflowEvents {
  "workflow:start": { workflowId: string };
  "workflow:complete": { workflowId: string; data: Record<string, unknown> };
  "workflow:fail": { workflowId: string; error: Error };
  "node:start": { workflowId: string; nodeId: string };
  "node:complete": { workflowId: string; nodeId: string; output: unknown };
  "node:fail": { workflowId: string; nodeId: string; error: Error };
  "node:retry": { workflowId: string; nodeId: string; attempt: number };
}
