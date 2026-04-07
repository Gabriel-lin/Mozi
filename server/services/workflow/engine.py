"""Workflow execution engine — runs a compiled LangGraph and publishes progress via Redis."""

from __future__ import annotations

import json
import time
from typing import Any

import structlog
from redis.asyncio import Redis

from .adapter import WorkflowGraphBuilder, WorkflowState

log = structlog.get_logger()

CHANNEL_PREFIX = "workflow:run:"
CONTROL_CHANNEL_PREFIX = "workflow:control:"


def _ts() -> int:
    return int(time.time() * 1000)


class WorkflowEngine:
    """Executes a workflow graph and streams node-level events through Redis Pub/Sub."""

    def __init__(self, redis: Redis, run_id: str, graph_data: dict):
        self.redis = redis
        self.run_id = run_id
        self.graph_data = graph_data
        self.channel = f"{CHANNEL_PREFIX}{run_id}"
        self.control_channel = f"{CONTROL_CHANNEL_PREFIX}{run_id}"
        self._cancelled = False

    TERMINAL_TYPES = frozenset(("run_completed", "run_failed", "run_cancelled"))

    async def publish(self, event: dict):
        event.setdefault("timestamp", _ts())
        payload = json.dumps(event, default=str)
        await self.redis.publish(self.channel, payload)
        if event.get("type") in self.TERMINAL_TYPES:
            await self.redis.set(f"{self.channel}:terminal", payload, ex=3600)

    async def _check_cancellation(self) -> bool:
        """Non-blocking check for cancel signal via Redis key."""
        val = await self.redis.get(f"workflow:cancel:{self.run_id}")
        if val:
            self._cancelled = True
        return self._cancelled

    async def execute(
        self,
        input_data: dict[str, Any] | None = None,
    ) -> dict:
        """Build, compile and execute the workflow graph. Returns final result dict.

        Publishes events:
          - run_started
          - node_started  (per node)
          - node_completed (per node)
          - node_error     (per node, non-fatal when possible)
          - run_completed
          - run_failed
          - run_cancelled
        """
        await self.publish({"type": "run_started", "run_id": self.run_id})

        builder = WorkflowGraphBuilder(self.graph_data)

        node_ids = [n["id"] for n in (self.graph_data.get("nodes") or [])]
        node_results: list[dict] = []
        final_output: dict[str, Any] = {}

        try:
            compiled = builder.build()
        except Exception as exc:
            await self.publish({
                "type": "run_failed",
                "error": f"工作流编译失败: {exc}",
            })
            raise

        initial_state: WorkflowState = {
            "messages": [],
            "context": {},
            "node_outputs": {},
            "current_input": (input_data or {}).get("input", ""),
        }

        try:
            prev_outputs: set[str] = set()
            async for step in compiled.astream(initial_state):
                if await self._check_cancellation():
                    await self.publish({"type": "run_cancelled"})
                    return {
                        "status": "cancelled",
                        "node_results": node_results,
                        "output_data": final_output,
                    }

                for node_key, node_state in step.items():
                    if node_key == "__end__":
                        continue

                    started = _ts()
                    await self.publish({
                        "type": "node_started",
                        "node_id": node_key,
                    })

                    outputs = (node_state or {}).get("node_outputs") or {}
                    new_ids = set(outputs.keys()) - prev_outputs
                    prev_outputs = set(outputs.keys())

                    for completed_id in new_ids:
                        node_out = outputs.get(completed_id, {})
                        completed = _ts()
                        node_result = {
                            "node_id": completed_id,
                            "status": node_out.get("status", "completed"),
                            "output": node_out.get("output"),
                            "started_at": started,
                            "completed_at": completed,
                            "duration_ms": completed - started,
                        }
                        node_results.append(node_result)
                        await self.publish({
                            "type": "node_completed",
                            "node_id": completed_id,
                            "output": node_out.get("output"),
                            "duration_ms": completed - started,
                        })

                    if isinstance(node_state, dict):
                        final_output = node_state.get("node_outputs") or final_output

        except Exception as exc:
            log.error("workflow_execution_error", run_id=self.run_id, error=str(exc))
            await self.publish({
                "type": "run_failed",
                "error": str(exc),
            })
            return {
                "status": "failed",
                "error": str(exc),
                "node_results": node_results,
                "output_data": final_output,
            }

        await self.publish({
            "type": "run_completed",
            "output": final_output,
            "node_results": node_results,
        })

        return {
            "status": "completed",
            "node_results": node_results,
            "output_data": final_output,
        }
