"""Celery tasks for sandbox execution."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from celery import Celery
from sqlalchemy import select

from shared.config import get_settings
from shared.database import async_session_factory
from shared.models.agent import Agent, AgentRun

log = structlog.get_logger()
settings = get_settings()

celery_app = Celery("mozi-sandbox", broker=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="agent-runs",
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="services.sandbox.tasks.execute_agent_run", bind=True, max_retries=2)
def execute_agent_run(self, run_id: str, agent_id: str, goal: str):
    _run_async(_execute(run_id, agent_id, goal))


async def _execute(run_id: str, agent_id: str, goal: str):
    from .executor import run_agent

    async with async_session_factory() as db:
        run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
        agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one()

        run.status = "executing"
        await db.commit()

        try:
            result = await run_agent(
                system_prompt=agent.system_prompt or "You are a helpful assistant.",
                goal=goal,
                model=agent.model,
                max_steps=agent.max_steps,
                workspace_id=agent.workspace_id,
            )
            run.status = "completed"
            run.output = {"answer": result["output"]}
            run.steps = result["steps"]
            run.total_steps = result["total_steps"]
        except Exception as exc:
            log.error("agent_run_failed", run_id=run_id, error=str(exc))
            run.status = "failed"
            run.error = str(exc)
        finally:
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
