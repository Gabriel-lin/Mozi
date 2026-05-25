"""Redis pub/sub for live agent run events (WebSocket relay on API side)."""

from __future__ import annotations

import json
import time

from redis.asyncio import Redis as AsyncRedis


def agent_run_channel(run_id: str) -> str:
    return f"agent:run:{run_id}"


def agent_cancel_key(run_id: str) -> str:
    return f"agent:cancel:{run_id}"


class AgentRunCancelError(Exception):
    """Raised when the client requested cancellation via Redis flag."""


class AgentRunPublisher:
    """Publish JSON events to `agent:run:{run_id}` and cache terminal payload."""

    def __init__(self, redis: AsyncRedis, run_id: str) -> None:
        self._redis = redis
        self._run_id = run_id
        self._channel = agent_run_channel(run_id)

    async def publish(self, event: dict) -> None:
        event = {**event, "timestamp": int(time.time() * 1000)}
        await self._redis.publish(self._channel, json.dumps(event, default=str))

    async def publish_terminal(self, event: dict) -> None:
        """Publish and set `:terminal` so late WebSocket subscribers see the outcome."""
        event = {**event, "timestamp": int(time.time() * 1000)}
        payload = json.dumps(event, default=str)
        await self._redis.publish(self._channel, payload)
        await self._redis.set(f"{self._channel}:terminal", payload, ex=3600)

    async def is_cancelled(self) -> bool:
        v = await self._redis.get(agent_cancel_key(self._run_id))
        return bool(v)
