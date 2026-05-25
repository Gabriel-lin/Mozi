"""Celery tasks for sandbox execution."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import structlog
from celery import Celery
from redis.asyncio import Redis as AsyncRedis
from shared.config import get_settings
from shared.database import async_engine, async_session_factory
from shared.models.agent import Agent, AgentRun
from sqlalchemy import select

from .agent_run_pub import AgentRunCancelError, AgentRunPublisher
from .llm_routing import apply_llm_provider_prefix, resolve_vendor_meta

log = structlog.get_logger()
settings = get_settings()


# Substrings that indicate the LLM endpoint is genuinely unreachable (DNS/refused/TLS),
# i.e. an env or networking misconfig rather than a slow upstream.
_NETWORK_MARKERS: tuple[str, ...] = (
    "connection refused",
    "connection error",  # httpx wraps DNS failures with this
    "connecterror",
    "name or service not known",
    "nodename nor servname",
    "failed to establish",
    "no route to host",
    "ssl",
    "tlsv",
)

# Substrings that indicate the endpoint replied (or accepted the connection) but the
# response did not arrive in time. Treated as transient upstream slowness.
_TIMEOUT_MARKERS: tuple[str, ...] = (
    "timed out",
    "timeout",
    "read timeout",
    "request timeout",
)


def _augment_llm_error(message: str, model: str | None = None) -> str:
    """Turn raw httpx/OpenAI errors into actionable advice.

    Keeps two cases distinct because they call for different fixes:
      * Network unreachable → check env vars / Docker networking.
      * Pure timeout → upstream model is reachable but slow; retry or raise the budget.
    """
    s = (message or "").strip()
    if not s:
        return s
    low = s.lower()

    vendor, base_url = resolve_vendor_meta(model)
    timeout = settings.llm_request_timeout_seconds
    retries = settings.llm_max_retries
    ctx_parts: list[str] = []
    if vendor:
        ctx_parts.append(f"vendor={vendor}")
    if base_url:
        ctx_parts.append(f"base_url={base_url}")
    ctx_parts.append(f"timeout={timeout:.0f}s")
    ctx_parts.append(f"retries={retries}")
    ctx = " [" + " ".join(ctx_parts) + "]"

    # Order matters: timeouts often also contain the word "connection" via wrapping
    # exceptions, but a true network failure does not say "timed out". Check timeout first.
    if any(x in low for x in _TIMEOUT_MARKERS) and "connection refused" not in low:
        return (
            f"{s}{ctx} — LLM 响应超时（端点可达，但模型未在 {timeout:.0f}s 内返回）。"
            f"通常是上游模型瞬时过载，先稍后重试；"
            f"持续发生可上调 MOZI_LLM_REQUEST_TIMEOUT_SECONDS（当前 {timeout:.0f}s）"
            f"或 MOZI_LLM_MAX_RETRIES（当前 {retries}）。"
        )

    if any(x in low for x in _NETWORK_MARKERS):
        return (
            f"{s}{ctx} — LLM 不可达。检查："
            "(a) sandbox Celery Worker 与 API 是否使用同一份 server/.env；"
            "(b) 当前模型对应厂商的 Key/Base URL：MOZI_OPENAI_API_KEY+MOZI_OPENAI_BASE_URL / "
            "MOZI_DEEPSEEK_API_KEY+MOZI_DEEPSEEK_BASE_URL / MOZI_ANTHROPIC_* / MOZI_GOOGLE_API_KEY；"
            "(c) Docker 中本地 vLLM 用 host.docker.internal 替换 localhost。"
        )

    return f"{s}{ctx}"

celery_app = Celery("mozi-sandbox", broker=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="agent-runs",
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


async def _run_and_dispose(coro):
    try:
        return await coro
    finally:
        # Celery prefork runs this sync task repeatedly, while _run_async creates
        # a fresh event loop per task. Do not let asyncpg connections from a
        # previous loop stay in SQLAlchemy's pool for the next task.
        await async_engine.dispose()


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_and_dispose(coro))
    finally:
        loop.close()


@celery_app.task(name="services.sandbox.tasks.execute_agent_run", bind=True, max_retries=2)
def execute_agent_run(self, run_id: str, agent_id: str, goal: str, model_override: str | None = None):
    _run_async(_execute(run_id, agent_id, goal, model_override))


async def _execute(run_id: str, agent_id: str, goal: str, model_override: str | None = None):
    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    pub = AgentRunPublisher(redis, run_id)
    # Bind early so the outer `except` (setup-time failure) can include model context too.
    model: str | None = (model_override or "").strip() or None
    try:
        # Import inside try so worker import errors mark the run failed instead of leaving it `idle`.
        from .executor import run_agent_streaming

        async with async_session_factory() as db:
            run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
            agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one()

            run.status = "executing"
            await db.commit()

            system_prompt = agent.system_prompt or "You are a helpful assistant."
            model_raw = (model_override or "").strip() or (agent.model or "")
            cfg = agent.config if isinstance(agent.config, dict) else {}
            model = apply_llm_provider_prefix(model_raw or None, cfg)
            max_steps = agent.max_steps
            workspace_id = agent.workspace_id

        await pub.publish({"type": "phase", "phase": "starting", "run_id": run_id})
        await pub.publish({"type": "phase", "phase": "context_ready", "agent_id": agent_id})

        try:

            async def publish(ev: dict) -> None:
                await pub.publish(ev)

            async def cancelled() -> bool:
                return await pub.is_cancelled()

            result = await asyncio.wait_for(
                run_agent_streaming(
                    system_prompt=system_prompt,
                    goal=goal,
                    model=model,
                    max_steps=max_steps,
                    workspace_id=workspace_id,
                    publish=publish,
                    cancelled=cancelled,
                ),
                timeout=settings.agent_run_timeout_seconds,
            )

            async with async_session_factory() as db:
                run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
                run.status = "completed"
                run.output = {"answer": result["output"]}
                run.steps = result["steps"]
                run.total_steps = result["total_steps"]
                run.completed_at = datetime.now(UTC)
                await db.commit()

            await pub.publish_terminal({
                "type": "run_completed",
                "run_id": run_id,
                "total_steps": result["total_steps"],
            })
        except AgentRunCancelError:
            log.info("agent_run_cancelled", run_id=run_id)
            async with async_session_factory() as db:
                run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
                run.status = "stopped"
                run.error = "cancelled"
                run.completed_at = datetime.now(UTC)
                await db.commit()
            await pub.publish_terminal({"type": "run_stopped", "run_id": run_id})
        except TimeoutError:
            err = f"Agent run timed out after {settings.agent_run_timeout_seconds:.0f} seconds."
            log.error("agent_run_failed", run_id=run_id, error=err)
            async with async_session_factory() as db:
                run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
                run.status = "failed"
                run.error = err
                run.completed_at = datetime.now(UTC)
                await db.commit()
            await pub.publish_terminal({"type": "run_failed", "run_id": run_id, "error": err})
        except Exception as exc:
            log.error("agent_run_failed", run_id=run_id, error=str(exc))
            err = _augment_llm_error(str(exc), model=model)
            async with async_session_factory() as db:
                run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
                run.status = "failed"
                run.error = err
                run.completed_at = datetime.now(UTC)
                await db.commit()
            await pub.publish_terminal({"type": "run_failed", "run_id": run_id, "error": err})
    except Exception as exc:
        # Import / DB / publish failures before the inner try's handlers (e.g. worker deps broken).
        err = _augment_llm_error(str(exc), model=model)
        log.error("agent_run_failed", run_id=run_id, error=str(exc), phase="setup")
        try:
            async with async_session_factory() as db:
                run = (await db.execute(select(AgentRun).where(AgentRun.id == run_id))).scalar_one()
                if run.status not in ("completed", "stopped", "failed"):
                    run.status = "failed"
                    run.error = err
                    run.completed_at = datetime.now(UTC)
                    await db.commit()
            await pub.publish_terminal({"type": "run_failed", "run_id": run_id, "error": err})
        except Exception as inner_exc:
            log.exception("agent_run_failure_persist_failed", run_id=run_id, error=str(inner_exc))
    finally:
        await redis.aclose()
