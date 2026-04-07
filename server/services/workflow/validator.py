"""Workflow graph validation — structure, connectivity, and node configuration checks."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    valid: bool = True
    errors: list[str] = field(default_factory=list)

    def add_error(self, msg: str):
        self.valid = False
        self.errors.append(msg)


def _get_node_kind(node: dict) -> str:
    """Resolve the logical kind of a node from its data payload.

    Priority: data.nodeKind > label keyword fallback > node.type
    """
    data = node.get("data") or {}
    kind = data.get("nodeKind", "")
    if kind in ("start", "end", "llm", "agent"):
        return kind
    label = (data.get("label") or data.get("text") or "").lower()
    if any(kw in label for kw in ("开始", "起始", "start")):
        return "start"
    if any(kw in label for kw in ("结束", "end")):
        return "end"
    return node.get("type", "workflowBase")


def validate_workflow(graph_data: dict) -> ValidationResult:
    """Validate a workflow graph_data dict before execution.

    Checks performed:
    1. Structural — exactly 1 start node, >=1 end node
    2. Edge integrity — no dangling source/target references
    3. Connectivity — all nodes reachable from start via BFS
    4. Configuration — LLM nodes have provider+model, agent nodes reference valid LLM
    """
    result = ValidationResult()
    nodes: list[dict] = graph_data.get("nodes") or []
    edges: list[dict] = graph_data.get("edges") or []

    if not nodes:
        result.add_error("工作流不包含任何节点")
        return result

    # ── Build lookup maps ──
    node_map: dict[str, dict] = {}
    kind_map: dict[str, str] = {}
    for n in nodes:
        nid = n.get("id", "")
        node_map[nid] = n
        kind_map[nid] = _get_node_kind(n)

    # ── 1. Structural: start / end nodes ──
    start_ids = [nid for nid, k in kind_map.items() if k == "start"]
    end_ids = [nid for nid, k in kind_map.items() if k == "end"]

    if len(start_ids) == 0:
        result.add_error("缺少开始节点")
    elif len(start_ids) > 1:
        result.add_error(f"存在多个开始节点 ({len(start_ids)}), 只允许 1 个")

    if len(end_ids) == 0:
        result.add_error("缺少结束节点")

    # ── 2. Edge integrity ──
    adj: dict[str, list[str]] = {nid: [] for nid in node_map}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src not in node_map:
            result.add_error(f"边 {edge.get('id','?')} 的起始节点 {src} 不存在")
            continue
        if tgt not in node_map:
            result.add_error(f"边 {edge.get('id','?')} 的目标节点 {tgt} 不存在")
            continue
        adj[src].append(tgt)

    # ── 3. Connectivity from start ──
    if start_ids and result.valid:
        visited: set[str] = set()
        queue: deque[str] = deque(start_ids)
        while queue:
            nid = queue.popleft()
            if nid in visited:
                continue
            visited.add(nid)
            for neighbor in adj.get(nid, []):
                if neighbor not in visited:
                    queue.append(neighbor)

        unreachable = set(node_map.keys()) - visited
        if unreachable:
            labels = [
                (node_map[nid].get("data") or {}).get("label", nid) for nid in unreachable
            ]
            result.add_error(f"以下节点从开始节点不可达: {', '.join(str(l) for l in labels)}")

    # ── 4. Node configuration checks ──
    llm_ids = set()
    for nid, kind in kind_map.items():
        data = (node_map[nid].get("data") or {})

        if kind == "llm":
            llm_ids.add(nid)
            if not data.get("provider"):
                label = data.get("label", nid)
                result.add_error(f"LLM 节点 '{label}' 缺少供应商配置")
            if not data.get("model"):
                label = data.get("label", nid)
                result.add_error(f"LLM 节点 '{label}' 缺少模型配置")

    for nid, kind in kind_map.items():
        if kind == "agent":
            data = (node_map[nid].get("data") or {})
            ref = data.get("llmNodeId")
            if ref and ref not in llm_ids:
                label = data.get("label", nid)
                result.add_error(f"Agent 节点 '{label}' 关联的 LLM 节点 '{ref}' 不存在")

    return result
