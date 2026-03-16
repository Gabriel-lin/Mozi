import { WorkflowError } from "../errors";
import { ErrorCode } from "../errors";
import type { WorkflowNode, WorkflowEdge, WorkflowDefinition } from "./types";
import { NodeType } from "./types";

export class WorkflowGraph {
  readonly id: string;
  readonly name: string;
  private nodes = new Map<string, WorkflowNode>();
  private adjacency = new Map<string, WorkflowEdge[]>();
  private reverseAdj = new Map<string, WorkflowEdge[]>();

  constructor(definition: WorkflowDefinition) {
    this.id = definition.id;
    this.name = definition.name;

    for (const node of definition.nodes) {
      this.nodes.set(node.id, node);
      this.adjacency.set(node.id, []);
      this.reverseAdj.set(node.id, []);
    }

    for (const edge of definition.edges) {
      if (!this.nodes.has(edge.from)) {
        throw new WorkflowError(`边的源节点不存在: ${edge.from}`, { code: ErrorCode.WORKFLOW_INVALID_GRAPH });
      }
      if (!this.nodes.has(edge.to)) {
        throw new WorkflowError(`边的目标节点不存在: ${edge.to}`, { code: ErrorCode.WORKFLOW_INVALID_GRAPH });
      }
      this.adjacency.get(edge.from)!.push(edge);
      this.reverseAdj.get(edge.to)!.push(edge);
    }

    this.validateNoCycle();
  }

  getNode(id: string): WorkflowNode | undefined {
    return this.nodes.get(id);
  }

  getSuccessors(nodeId: string): WorkflowEdge[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  getPredecessors(nodeId: string): WorkflowEdge[] {
    return this.reverseAdj.get(nodeId) ?? [];
  }

  getEntryNodes(): WorkflowNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.type === NodeType.START || this.getPredecessors(n.id).length === 0,
    );
  }

  getExitNodes(): WorkflowNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.type === NodeType.END || this.getSuccessors(n.id).length === 0,
    );
  }

  allNodes(): WorkflowNode[] {
    return Array.from(this.nodes.values());
  }

  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, this.getPredecessors(id).length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const edge of this.getSuccessors(current)) {
        const newDeg = inDegree.get(edge.to)! - 1;
        inDegree.set(edge.to, newDeg);
        if (newDeg === 0) queue.push(edge.to);
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new WorkflowError("工作流图包含环", { code: ErrorCode.WORKFLOW_CYCLE });
    }

    return sorted;
  }

  private validateNoCycle(): void {
    this.topologicalSort();
  }
}
