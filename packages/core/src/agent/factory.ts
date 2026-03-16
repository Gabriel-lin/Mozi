import { AgentError, ErrorCode } from "../errors";
import { ReActAgent } from "./react-agent";
import type { Agent, AgentBlueprint, AgentConfig, AgentMeta } from "./types";

type AgentConstructor = new (config: AgentConfig) => Agent;

let idCounter = 0;

export class AgentFactory {
  private constructors = new Map<string, AgentConstructor>();
  private blueprints = new Map<string, AgentBlueprint>();

  constructor() {
    this.registerType("react", ReActAgent);
  }

  registerType(type: string, constructor: AgentConstructor): void {
    this.constructors.set(type, constructor);
  }

  registerBlueprint(name: string, blueprint: AgentBlueprint): void {
    this.blueprints.set(name, blueprint);
  }

  create(type: string, config: AgentConfig): Agent {
    const Ctor = this.constructors.get(type);
    if (!Ctor) {
      throw new AgentError(`未知智能体类型: ${type}`, { code: ErrorCode.AGENT_NOT_FOUND });
    }
    return new Ctor(config);
  }

  createFromBlueprint(blueprintName: string, overrides?: Partial<AgentMeta>): Agent {
    const blueprint = this.blueprints.get(blueprintName);
    if (!blueprint) {
      throw new AgentError(`模板未找到: ${blueprintName}`, { code: ErrorCode.AGENT_NOT_FOUND });
    }

    const Ctor = this.constructors.get(blueprint.type);
    if (!Ctor) {
      throw new AgentError(`未知智能体类型: ${blueprint.type}`, { code: ErrorCode.AGENT_NOT_FOUND });
    }

    const meta: AgentMeta = {
      id: overrides?.id ?? `agent-${++idCounter}`,
      name: overrides?.name ?? blueprint.config.meta?.name ?? blueprintName,
      description: overrides?.description ?? blueprint.config.meta?.description,
      maxSteps: overrides?.maxSteps ?? blueprint.config.meta?.maxSteps ?? 10,
      model: overrides?.model ?? blueprint.config.meta?.model,
      tags: overrides?.tags ?? blueprint.config.meta?.tags,
    };

    return new Ctor({ ...blueprint.config, meta });
  }

  listTypes(): string[] {
    return Array.from(this.constructors.keys());
  }

  listBlueprints(): Array<{ name: string; blueprint: AgentBlueprint }> {
    return Array.from(this.blueprints.entries()).map(([name, blueprint]) => ({ name, blueprint }));
  }
}

export class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(agent: Agent): void {
    if (this.agents.has(agent.meta.id)) {
      throw new AgentError(`智能体已注册: ${agent.meta.id}`, { code: ErrorCode.AGENT_ALREADY_RUNNING });
    }
    this.agents.set(agent.meta.id, agent);
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  findByTag(tag: string): Agent[] {
    return this.getAll().filter((a) => a.meta.tags?.includes(tag));
  }

  clear(): void {
    for (const agent of this.agents.values()) {
      agent.stop();
    }
    this.agents.clear();
  }

  get size(): number {
    return this.agents.size;
  }
}
