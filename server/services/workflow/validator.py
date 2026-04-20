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


def is_executable_node(node: dict) -> bool:
    """Return whether this node participates in runtime execution.

    React Flow `type: "group"` nodes are pure visual containers used to group
    other nodes spatially via `parentId` / `extent: "parent"`. They have no
    handles, no edges and no runtime behavior, so they must be excluded from
    validation and from the compiled execution graph.

    An explicit `data.nodeKind` still takes precedence — a node could in
    theory be visually rendered as a group while semantically executable
    (e.g. a future workflow-as-agent encapsulation), in which case
    `data.nodeKind` would override the visual-only classification.
    """
    data = node.get("data") or {}
    if data.get("nodeKind") in ("start", "end", "llm", "agent"):
        return True
    return node.get("type") != "group"


def validate_workflow(graph_data: dict) -> ValidationResult:
    """Validate a workflow graph_data dict before execution.

    Checks performed (on executable nodes only — visual-only group
    containers are ignored):
    1. Structural — exactly 1 start node, >=1 end node
    2. Edge integrity — no dangling source/target references
    3. Connectivity — all executable nodes reachable from start via BFS
    4. Configuration — LLM nodes have provider+model, agent nodes reference valid LLM
    """
    result = ValidationResult()
    all_nodes: list[dict] = graph_data.get("nodes") or []
    edges: list[dict] = graph_data.get("edges") or []

    if not all_nodes:
        result.add_error("工作流不包含任何节点")
        return result

    # Filter out visual-only containers (React Flow group nodes).
    nodes: list[dict] = [n for n in all_nodes if is_executable_node(n)]

    if not nodes:
        result.add_error("工作流不包含任何可执行节点")
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
    # Visual-only (group) nodes are excluded from node_map, so edges that
    # reference them are silently skipped rather than reported as dangling.
    all_ids = {n.get("id", "") for n in all_nodes}
    adj: dict[str, list[str]] = {nid: [] for nid in node_map}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src not in all_ids:
            result.add_error(f"边 {edge.get('id','?')} 的起始节点 {src} 不存在")
            continue
        if tgt not in all_ids:
            result.add_error(f"边 {edge.get('id','?')} 的目标节点 {tgt} 不存在")
            continue
        if src not in node_map or tgt not in node_map:
            # edge touches a visual-only node — ignore for execution purposes
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
    # NOTE: runtime-only checks (e.g. API Key presence, model reachability)
    # are intentionally deferred to execution so that the workflow run
    # actually starts and the specific node can be attributed the failure
    # via ``node_error`` events. Only static-structural problems are
    # reported here.
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
