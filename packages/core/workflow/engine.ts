import { WorkflowError } from "../errors";
import { ErrorCode } from "../errors";
import { Logger } from "../logger";
import { WorkflowGraph } from "./graph";
import {
  NodeStatus,
  NodeType,
  WorkflowStatus,
  type NodeResult,
  type WorkflowContext,
  type WorkflowDefinition,
  type WorkflowEvents,
  type WorkflowNode,
} from "./types";

type EventCallback<T = unknown> = (payload: T) => void;

function createContext(workflowId: string): WorkflowContext {
  const data: Record<string, unknown> = {};
  return {
    workflowId,
    data,
    nodeResults: new Map(),
    get<T = unknown>(key: string): T | undefined {
      return data[key] as T | undefined;
    },
    set(key: string, value: unknown) {
      data[key] = value;
    },
  };
}

export class WorkflowEngine {
  private graph: WorkflowGraph;
  private definition: WorkflowDefinition;
  private ctx: WorkflowContext;
  private status: WorkflowStatus = WorkflowStatus.IDLE;
  private listeners = new Map<string, Set<EventCallback>>();
  private logger: Logger;
  private abortController: AbortController | null = null;

  constructor(definition: WorkflowDefinition, logger?: Logger) {
    this.definition = definition;
    this.graph = new WorkflowGraph(definition);
    this.ctx = createContext(definition.id);
    this.logger = logger ?? new Logger({ module: `workflow:${definition.id}` });
  }

  on<K extends keyof WorkflowEvents>(event: K, callback: EventCallback<WorkflowEvents[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback as EventCallback);
    return () => this.listeners.get(event)?.delete(callback as EventCallback);
  }

  private emit<K extends keyof WorkflowEvents>(event: K, payload: WorkflowEvents[K]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        /* ignore */
      }
    });
  }

  getStatus(): WorkflowStatus {
    return this.status;
  }

  getContext(): WorkflowContext {
    return this.ctx;
  }

  getNodeResult(nodeId: string): NodeResult | undefined {
    return this.ctx.nodeResults.get(nodeId);
  }

  async run(initialData?: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.status === WorkflowStatus.RUNNING) {
      throw new WorkflowError("工作流正在运行", { workflowId: this.definition.id });
    }

    this.status = WorkflowStatus.RUNNING;
    this.abortController = new AbortController();
    this.ctx = createContext(this.definition.id);
    if (initialData) Object.assign(this.ctx.data, initialData);

    this.emit("workflow:start", { workflowId: this.definition.id });
    this.logger.info("工作流启动", { workflow: this.definition.name });

    try {
      const sortedIds = this.graph.topologicalSort();

      for (const nodeId of sortedIds) {
        if (this.abortController.signal.aborted) {
          this.status = WorkflowStatus.CANCELLED;
          return this.ctx.data;
        }

        const node = this.graph.getNode(nodeId)!;

        const predecessors = this.graph.getPredecessors(nodeId);
        const allPredCompleted = predecessors.every((e) => {
          const r = this.ctx.nodeResults.get(e.from);
          return r && (r.status === NodeStatus.COMPLETED || r.status === NodeStatus.SKIPPED);
        });
        if (!allPredCompleted && predecessors.length > 0) {
          this.recordResult(nodeId, NodeStatus.SKIPPED);
          continue;
        }

        const shouldExecute = await this.evaluateEdgeConditions(nodeId);
        if (!shouldExecute) {
          this.recordResult(nodeId, NodeStatus.SKIPPED);
          continue;
        }

        await this.executeNode(node);
      }

      this.status = WorkflowStatus.COMPLETED;
      this.emit("workflow:complete", { workflowId: this.definition.id, data: this.ctx.data });
      this.logger.info("工作流完成");
      return this.ctx.data;
    } catch (error) {
      this.status = WorkflowStatus.FAILED;
      this.emit("workflow:fail", { workflowId: this.definition.id, error: error as Error });
      this.logger.error("工作流失败", error as Error);
      throw error;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.status = WorkflowStatus.CANCELLED;
      this.logger.warn("工作流已取消");
    }
  }

  private async executeNode(node: WorkflowNode): Promise<void> {
    if (node.type === NodeType.START || node.type === NodeType.END) {
      this.recordResult(node.id, NodeStatus.COMPLETED);
      return;
    }

    if (node.type === NodeType.CONDITION) {
      await this.executeConditionNode(node);
      return;
    }

    if (node.type === NodeType.PARALLEL) {
      await this.executeParallelNode(node);
      return;
    }

    const maxRetries = node.retries ?? 0;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.emit("node:start", { workflowId: this.definition.id, nodeId: node.id });
        const startedAt = Date.now();

        let output: unknown;
        if (node.handler) {
          if (node.timeoutMs) {
            output = await this.withTimeout(Promise.resolve(node.handler(this.ctx, node)), node.timeoutMs, node.id);
          } else {
            output = await node.handler(this.ctx, node);
          }
        }

        this.ctx.nodeResults.set(node.id, {
          nodeId: node.id,
          status: NodeStatus.COMPLETED,
          output,
          startedAt,
          completedAt: Date.now(),
          retryCount: attempt,
        });

        this.emit("node:complete", { workflowId: this.definition.id, nodeId: node.id, output });
        this.logger.debug(`节点完成: ${node.name}`, { nodeId: node.id, attempt });
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.emit("node:retry", { workflowId: this.definition.id, nodeId: node.id, attempt: attempt + 1 });
          this.logger.warn(`节点重试: ${node.name}`, { nodeId: node.id, attempt: attempt + 1 });
        }
      }
    }

    this.recordResult(node.id, NodeStatus.FAILED, lastError);
    this.emit("node:fail", { workflowId: this.definition.id, nodeId: node.id, error: lastError! });
    throw new WorkflowError(`节点执行失败: ${node.name}`, {
      code: ErrorCode.WORKFLOW_NODE_FAILED,
      workflowId: this.definition.id,
      nodeId: node.id,
      cause: lastError,
    });
  }

  private async executeConditionNode(node: WorkflowNode): Promise<void> {
    const result = node.condition ? await node.condition(this.ctx) : true;
    this.ctx.data[`__condition_${node.id}`] = result;
    this.recordResult(node.id, NodeStatus.COMPLETED, undefined, result);
  }

  private async executeParallelNode(node: WorkflowNode): Promise<void> {
    const successors = this.graph.getSuccessors(node.id);
    const parallelNodes = successors
      .map((e) => this.graph.getNode(e.to))
      .filter((n): n is WorkflowNode => n !== undefined);

    const results = await Promise.allSettled(parallelNodes.map((n) => this.executeNode(n)));

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      this.recordResult(node.id, NodeStatus.FAILED);
      throw new WorkflowError(`并行节点部分失败: ${failures.length}/${results.length}`, {
        code: ErrorCode.WORKFLOW_NODE_FAILED,
        workflowId: this.definition.id,
        nodeId: node.id,
      });
    }

    this.recordResult(node.id, NodeStatus.COMPLETED);
  }

  private async evaluateEdgeConditions(nodeId: string): Promise<boolean> {
    const incomingEdges = this.graph.getPredecessors(nodeId);
    if (incomingEdges.length === 0) return true;

    for (const edge of incomingEdges) {
      if (edge.condition) {
        const result = await edge.condition(this.ctx);
        if (result) return true;
      } else {
        return true;
      }
    }

    return incomingEdges.every((e) => !e.condition);
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, nodeId: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new WorkflowError(`节点超时: ${ms}ms`, {
          code: ErrorCode.WORKFLOW_TIMEOUT,
          nodeId,
        })), ms),
      ),
    ]);
  }

  private recordResult(nodeId: string, status: NodeStatus, error?: Error, output?: unknown): void {
    this.ctx.nodeResults.set(nodeId, {
      nodeId,
      status,
      output,
      error,
      startedAt: Date.now(),
      completedAt: Date.now(),
      retryCount: 0,
    });
  }
}
