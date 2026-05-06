from datetime import UTC

from shared.config import get_settings
from shared.models.agent import Agent, AgentRun
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()


def build_effective_goal(goal: str, attachments: list | None) -> str:
    """Append attachment blocks for the worker (length-capped)."""
    head = goal.strip() or "(see attachments)"
    parts = [head]
    for a in attachments or []:
        name = getattr(a, "name", None) or (a.get("name") if isinstance(a, dict) else "") or "file"
        text = getattr(a, "text", None) if not isinstance(a, dict) else a.get("text")
        if text:
            parts.append(f"\n\n---\n### Attachment: `{name}`\n{text}")
        else:
            parts.append(f"\n\n---\n_(Attachment `{name}` — no text payload)_")
    s = "\n".join(parts)
    return s[:80_000]


async def create_agent(db: AsyncSession, created_by: str, data: dict) -> Agent:
    payload = {**data}
    if payload.get("config") is None:
        payload["config"] = {}
    if payload.get("tags") is None:
        payload["tags"] = []
    if payload.get("model") is None:
        s = settings
        if s.openai_api_key:
            payload["model"] = s.default_llm_model
        elif s.anthropic_api_key:
            payload["model"] = s.anthropic_default_model
        elif s.google_api_key:
            payload["model"] = s.google_default_model
        elif s.deepseek_api_key:
            payload["model"] = s.deepseek_default_model
        else:
            payload["model"] = s.vllm_model
    agent = Agent(created_by=created_by, **payload)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


async def list_agents(db: AsyncSession, workspace_id: str, page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    query = select(Agent).where(Agent.workspace_id == workspace_id).order_by(desc(Agent.created_at))
    count_q = select(func.count()).select_from(Agent).where(Agent.workspace_id == workspace_id)

    result = await db.execute(query.offset(offset).limit(page_size))
    total = (await db.execute(count_q)).scalar_one()
    return result.scalars().all(), total, page, page_size


async def get_agent(db: AsyncSession, agent_id: str) -> Agent | None:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    return result.scalar_one_or_none()


async def update_agent(db: AsyncSession, agent_id: str, data: dict) -> Agent | None:
    agent = await get_agent(db, agent_id)
    if not agent:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(agent, k, v)
    await db.commit()
    await db.refresh(agent)
    return agent


async def delete_agent(db: AsyncSession, agent_id: str):
    agent = await get_agent(db, agent_id)
    if agent:
        await db.delete(agent)
        await db.commit()


async def start_run(
    db: AsyncSession,
    agent_id: str,
    goal: str,
    triggered_by: str,
    attachments: list | None = None,
    model_override: str | None = None,
) -> AgentRun:
    from datetime import datetime

    effective = build_effective_goal(goal, attachments)
    run = AgentRun(
        agent_id=agent_id,
        goal=effective,
        status="idle",
        triggered_by=triggered_by,
        started_at=datetime.now(UTC),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Use the same Celery app instance as the sandbox worker (`services.sandbox.main:celery_app`)
    # so routing/serialization matches the consumer.
    from services.sandbox.tasks import celery_app as sandbox_celery

    kwargs: dict = {"run_id": run.id, "agent_id": agent_id, "goal": effective}
    # Only pass model_override when it differs from the saved agent model. This keeps Celery
    # kwargs compatible with older workers and avoids redundant queue payloads when the UI
    # always sends the current selection (e.g. gpt-5.4 matching the agent default).
    mo = (model_override or "").strip()
    if mo:
        agent = await get_agent(db, agent_id)
        saved = (agent.model or "").strip() if agent else ""
        if mo != saved:
            kwargs["model_override"] = mo

    sandbox_celery.send_task(
        "services.sandbox.tasks.execute_agent_run",
        kwargs=kwargs,
        queue="agent-runs",
    )
    return run


async def get_run(db: AsyncSession, run_id: str) -> AgentRun | None:
    result = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    return result.scalar_one_or_none()


async def delete_run(db: AsyncSession, run_id: str) -> bool:
    run = await get_run(db, run_id)
    if not run:
        return False
    await db.delete(run)
    await db.commit()
    return True


async def set_run_pinned(db: AsyncSession, run_id: str, pinned: bool) -> AgentRun | None:
    from datetime import datetime

    run = await get_run(db, run_id)
    if not run:
        return None
    run.pinned_at = datetime.now(UTC) if pinned else None
    await db.commit()
    await db.refresh(run)
    return run


async def set_run_feedback(db: AsyncSession, run_id: str, feedback: str | None) -> AgentRun | None:
    run = await get_run(db, run_id)
    if not run:
        return None
    run.feedback = feedback
    await db.commit()
    await db.refresh(run)
    return run


async def list_runs(db: AsyncSession, agent_id: str, page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    query = (
        select(AgentRun)
        .where(AgentRun.agent_id == agent_id)
        .order_by(
            case((AgentRun.pinned_at.is_(None), 1), else_=0),
            desc(AgentRun.pinned_at),
            desc(AgentRun.created_at),
        )
    )
    count_q = select(func.count()).select_from(AgentRun).where(AgentRun.agent_id == agent_id)

    result = await db.execute(query.offset(offset).limit(page_size))
    total = (await db.execute(count_q)).scalar_one()
    return result.scalars().all(), total, page, page_size
