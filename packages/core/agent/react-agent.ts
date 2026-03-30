import { AgentError, ErrorCode } from "../errors";
import { Logger } from "../logger";
import { SimpleMemory } from "./memory";
import {
  AgentStatus,
  type Agent,
  type AgentConfig,
  type AgentMeta,
  type AgentRunResult,
  type AgentStep,
  type AgentTool,
  type AgentMemory,
} from "./types";

let idCounter = 0;

export class ReActAgent implements Agent {
  readonly meta: AgentMeta;
  private _status: AgentStatus = AgentStatus.IDLE;
  private tools = new Map<string, AgentTool>();
  private steps: AgentStep[] = [];
  private memory: AgentMemory;
  private currentStep = 0;
  private systemPrompt: string;
  private logger: Logger;
  private onStep?: (step: AgentStep) => void;
  private onComplete?: (result: AgentRunResult) => void;
  private onError?: (error: Error) => void;
  private aborted = false;

  constructor(config: AgentConfig) {
    this.meta = {
      id: config.meta.id ?? `agent-${++idCounter}`,
      name: config.meta.name,
      description: config.meta.description,
      version: config.meta.version ?? "0.1.0",
      maxSteps: config.meta.maxSteps ?? 10,
      model: config.meta.model,
      tags: config.meta.tags,
    };
    this.systemPrompt = config.systemPrompt ?? "You are a helpful assistant.";
    this.memory = new SimpleMemory();
    this.logger = new Logger({ module: `agent:${this.meta.id}` });
    this.onStep = config.onStep;
    this.onComplete = config.onComplete;
    this.onError = config.onError;

    for (const tool of config.tools ?? []) {
      this.tools.set(tool.name, tool);
    }
  }

  get status(): AgentStatus {
    return this._status;
  }

  addTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  removeTool(name: string): void {
    this.tools.delete(name);
  }

  getHistory(): AgentStep[] {
    return [...this.steps];
  }

  reset(): void {
    this._status = AgentStatus.IDLE;
    this.steps = [];
    this.currentStep = 0;
    this.memory.clear();
    this.aborted = false;
  }

  stop(): void {
    this.aborted = true;
    this._status = AgentStatus.STOPPED;
  }

  async run(goal: string, params?: Record<string, unknown>): Promise<AgentRunResult> {
    if (this._status === AgentStatus.EXECUTING) {
      throw new AgentError("智能体正在运行", {
        code: ErrorCode.AGENT_ALREADY_RUNNING,
        agentId: this.meta.id,
      });
    }

    this.reset();
    this._status = AgentStatus.PLANNING;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    this.memory.add({ role: "system", content: this.systemPrompt });
    this.memory.add({
      role: "user",
      content: params ? `${goal}\n参数: ${JSON.stringify(params)}` : goal,
    });

    this.logger.info("智能体开始运行", { goal, runId });

    try {
      this._status = AgentStatus.EXECUTING;

      while (this.currentStep < this.meta.maxSteps && !this.aborted) {
        const step = await this.step();

        if (step.action === "finish" || step.action === "final_answer") {
          this._status = AgentStatus.COMPLETED;
          break;
        }
      }

      if (this.currentStep >= this.meta.maxSteps && this._status !== AgentStatus.COMPLETED) {
        this._status = AgentStatus.FAILED;
        throw new AgentError(`已达最大步数: ${this.meta.maxSteps}`, {
          code: ErrorCode.AGENT_STEP_LIMIT,
          agentId: this.meta.id,
        });
      }

      const result: AgentRunResult = {
        agentId: this.meta.id,
        runId,
        status: this._status,
        steps: [...this.steps],
        output: this.steps[this.steps.length - 1]?.observation,
        startedAt,
        completedAt: Date.now(),
        totalSteps: this.currentStep,
      };

      this.onComplete?.(result);
      return result;
    } catch (error) {
      this._status = AgentStatus.FAILED;
      const result: AgentRunResult = {
        agentId: this.meta.id,
        runId,
        status: AgentStatus.FAILED,
        steps: [...this.steps],
        error: error as Error,
        startedAt,
        completedAt: Date.now(),
        totalSteps: this.currentStep,
      };
      this.onError?.(error as Error);
      this.onComplete?.(result);
      throw error;
    }
  }

  async step(): Promise<AgentStep> {
    this.currentStep++;
    const stepId = this.currentStep;

    const thought = `Step ${stepId}: 分析当前状态和可用工具`;
    const availableTools = Array.from(this.tools.keys());

    let action: string | undefined;
    let actionInput: Record<string, unknown> | undefined;
    let observation: string | undefined;

    if (availableTools.length > 0 && stepId < this.meta.maxSteps) {
      action = availableTools[0];
      actionInput = {};
    } else {
      action = "finish";
    }

    if (action && action !== "finish" && action !== "final_answer") {
      const tool = this.tools.get(action);
      if (tool) {
        try {
          const toolResult = await tool.execute(actionInput ?? {});
          observation = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
        } catch (error) {
          observation = `工具执行失败: ${(error as Error).message}`;
          this.logger.warn(`工具 ${action} 失败`, { error: (error as Error).message });
        }
      } else {
        observation = `工具未找到: ${action}`;
      }
    }

    const step: AgentStep = {
      stepId,
      thought,
      action,
      actionInput,
      observation,
      timestamp: Date.now(),
    };

    this.steps.push(step);
    this.memory.add({ role: "assistant", content: `Thought: ${thought}\nAction: ${action}` });
    if (observation) {
      this.memory.add({ role: "user", content: `Observation: ${observation}` });
    }

    this.onStep?.(step);
    this.logger.debug(`步骤 ${stepId}`, { action, hasObservation: !!observation });
    return step;
  }
}
