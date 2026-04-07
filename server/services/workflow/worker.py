"""Celery worker for workflow execution.

Usage:
    uv run celery -A services.workflow.worker:celery_app worker \
        -Q workflow-runs -c 2 --loglevel=info
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from celery import Celery
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from shared.config import get_settings
from shared.models.workflow import WorkflowRun, WorkflowVersion

log = structlog.get_logger()
settings = get_settings()

celery_app = Celery("mozi-workflow", broker=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="workflow-runs",
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


def _make_session_factory():
    """Create a per-task engine + session factory.

    Uses NullPool so connections are never shared across event loops.
    """
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        poolclass=NullPool,
    )
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@celery_app.task(
    name="services.workflow.worker.execute_workflow_run",
    bind=True,
    max_retries=1,
)
def execute_workflow_run(self, run_id: str):
    """Celery entry point — delegates to the async implementation."""
    asyncio.run(_execute(run_id))


async def _execute(run_id: str):
    from .engine import WorkflowEngine

    engine, session_factory = _make_session_factory()
    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)

    try:
        async with session_factory() as db:
            run = (
                await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
            ).scalar_one_or_none()

            if not run:
                log.error("workflow_run_not_found", run_id=run_id)
                return

            if run.version_id:
                version = (
                    await db.execute(
                        select(WorkflowVersion).where(WorkflowVersion.id == run.version_id)
                    )
                ).scalar_one_or_none()
            else:
                version = (
                    await db.execute(
                        select(WorkflowVersion)
                        .where(WorkflowVersion.workflow_id == run.workflow_id)
                        .order_by(WorkflowVersion.version.desc())
                        .limit(1)
                    )
                ).scalar_one_or_none()

            if not version or not version.graph_data:
                run.status = "failed"
                run.error = "没有可执行的工作流版本"
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
                return

            run.status = "running"
            run.version_id = version.id
            run.started_at = datetime.now(timezone.utc)
            await db.commit()

            wf_engine = WorkflowEngine(
                redis=redis,
                run_id=run_id,
                graph_data=version.graph_data,
            )

            try:
                result = await wf_engine.execute(input_data=run.input_data)

                run.status = result.get("status", "completed")
                run.output_data = result.get("output_data")
                run.node_results = result.get("node_results", [])
                if result.get("error"):
                    run.error = result["error"]

            except Exception as exc:
                log.error("workflow_run_failed", run_id=run_id, error=str(exc))
                run.status = "failed"
                run.error = str(exc)

            finally:
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()

    finally:
        await redis.aclose()
        await engine.dispose()
