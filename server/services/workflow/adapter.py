"""Adapter: convert frontend graph_data JSON into a compiled LangGraph StateGraph."""

from __future__ import annotations

from typing import Any, TypedDict

import structlog
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

log = structlog.get_logger()


# ── State schema shared across all workflow nodes ──

class WorkflowState(TypedDict, total=False):
    messages: list[Any]
    context: dict[str, Any]
    node_outputs: dict[str, Any]
    current_input: str


# ── LLM factory ──

def _create_chat_model(node_data: dict) -> BaseChatModel:
    """Build a LangChain ChatModel from node configuration."""
    provider = node_data.get("provider", "openai")
    model = node_data.get("model", "gpt-4o")
    api_key = node_data.get("apiKey") or "EMPTY"
    api_base = node_data.get("apiBase") or None
    temperature = float(node_data.get("temperature", 0.7))

    match provider:
        case "anthropic":
            try:
                from langchain_anthropic import ChatAnthropic
                return ChatAnthropic(
                    api_key=api_key,
                    model_name=model,
                    temperature=temperature,
                )
            except ImportError:
                log.warning("langchain-anthropic not installed, falling back to ChatOpenAI")
                return ChatOpenAI(
                    api_key=api_key,
                    model=model,
                    temperature=temperature,
                    base_url=api_base,
                )
        case "google":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    google_api_key=api_key,
                    model=model,
                    temperature=temperature,
                )
            except ImportError:
                log.warning("langchain-google-genai not installed, falling back to ChatOpenAI")
                return ChatOpenAI(
                    api_key=api_key,
                    model=model,
                    temperature=temperature,
                    base_url=api_base,
                )
        case _:
            kwargs: dict[str, Any] = {
                "api_key": api_key,
                "model": model,
                "temperature": temperature,
            }
            if api_base:
                kwargs["base_url"] = api_base
            return ChatOpenAI(**kwargs)


def _get_node_kind(node: dict) -> str:
    """Priority: data.nodeKind > label keyword fallback > node.type"""
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


class WorkflowGraphBuilder:
    """Transforms a frontend workflow graph_data dict into a compiled LangGraph."""

    def __init__(self, graph_data: dict):
        self.raw_nodes: list[dict] = graph_data.get("nodes") or []
        self.raw_edges: list[dict] = graph_data.get("edges") or []
        self.node_map: dict[str, dict] = {n["id"]: n for n in self.raw_nodes}
        self.kind_map: dict[str, str] = {n["id"]: _get_node_kind(n) for n in self.raw_nodes}

    def build(self) -> CompiledStateGraph:
        graph = StateGraph(WorkflowState)

        start_ids: list[str] = []
        end_ids: list[str] = []

        for nid, kind in self.kind_map.items():
            if kind == "start":
                start_ids.append(nid)
            elif kind == "end":
                end_ids.append(nid)

        for nid, node in self.node_map.items():
            kind = self.kind_map[nid]

            if kind == "start":
                graph.add_node(nid, self._make_start_fn(nid))
            elif kind == "end":
                graph.add_node(nid, self._make_end_fn(nid))
            elif kind == "llm":
                graph.add_node(nid, self._make_llm_fn(nid, node))
            elif kind == "agent":
                graph.add_node(nid, self._make_agent_fn(nid, node))
            else:
                graph.add_node(nid, self._make_passthrough_fn(nid, node))

        # Wire START → start node(s)
        for sid in start_ids:
            graph.add_edge(START, sid)

        # Wire end node(s) → END
        for eid in end_ids:
            graph.add_edge(eid, END)

        # Wire user-defined edges (skip start/end since they're handled above)
        for edge in self.raw_edges:
            src = edge.get("source", "")
            tgt = edge.get("target", "")
            if src not in self.node_map or tgt not in self.node_map:
                continue
            if self.kind_map.get(tgt) == "end":
                pass  # already wired to END
            graph.add_edge(src, tgt)

        return graph.compile()

    # ── Node function factories ──

    def _make_start_fn(self, nid: str):
        def start_node(state: WorkflowState) -> dict:
            return {
                "node_outputs": {
                    **state.get("node_outputs", {}),
                    nid: {"status": "completed"},
                },
            }
        start_node.__name__ = f"start_{nid}"
        return start_node

    def _make_end_fn(self, nid: str):
        def end_node(state: WorkflowState) -> dict:
            return {
                "node_outputs": {
                    **state.get("node_outputs", {}),
                    nid: {"status": "completed", "output": state.get("node_outputs", {})},
                },
            }
        end_node.__name__ = f"end_{nid}"
        return end_node

    def _make_llm_fn(self, nid: str, node: dict):
        data = node.get("data") or {}
        llm = _create_chat_model(data)

        async def llm_node(state: WorkflowState) -> dict:
            messages = list(state.get("messages") or [])
            if not messages:
                current = state.get("current_input", "")
                if current:
                    messages.append(HumanMessage(content=current))

            response = await llm.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            return {
                "messages": [*state.get("messages", []), response],
                "node_outputs": {
                    **state.get("node_outputs", {}),
                    nid: {"status": "completed", "output": content},
                },
            }

        llm_node.__name__ = f"llm_{nid}"
        return llm_node

    def _make_agent_fn(self, nid: str, node: dict):
        data = node.get("data") or {}
        llm_ref = data.get("llmNodeId")
        system_prompt = data.get("systemPrompt", "You are a helpful assistant.")
        user_prompt_template = data.get("userPrompt", "")

        if llm_ref and llm_ref in self.node_map:
            llm_data = self.node_map[llm_ref].get("data") or {}
        else:
            llm_data = data
        llm = _create_chat_model(llm_data)

        async def agent_node(state: WorkflowState) -> dict:
            messages: list[Any] = []
            if system_prompt:
                messages.append(SystemMessage(content=system_prompt))

            current_input = state.get("current_input", "")
            prompt = user_prompt_template.replace("{input}", current_input) if user_prompt_template else current_input
            if prompt:
                messages.append(HumanMessage(content=prompt))

            response = await llm.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            return {
                "messages": [*state.get("messages", []), response],
                "node_outputs": {
                    **state.get("node_outputs", {}),
                    nid: {"status": "completed", "output": content},
                },
            }

        agent_node.__name__ = f"agent_{nid}"
        return agent_node

    def _make_passthrough_fn(self, nid: str, node: dict):
        data = node.get("data") or {}
        label = data.get("label") or data.get("text") or ""

        def passthrough_node(state: WorkflowState) -> dict:
            return {
                "node_outputs": {
                    **state.get("node_outputs", {}),
                    nid: {"status": "completed", "output": label},
                },
            }

        passthrough_node.__name__ = f"pass_{nid}"
        return passthrough_node
