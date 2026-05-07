from datetime import UTC, datetime

from redis.asyncio import Redis as AsyncRedis
from shared.config import get_settings
from shared.models.agent import Agent, AgentRun
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.sandbox.agent_run_pub import agent_cancel_key, agent_run_channel

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


def _linear_conversation_rows(conversation: list | dict | None) -> list:
    """Normalize DB `conversation` JSON (legacy list or v2 {linear, tree}) to role/text rows for the worker."""
    if conversation is None:
        return []
    if isinstance(conversation, list):
        return conversation
    if isinstance(conversation, dict):
        if conversation.get("v") == 2:
            lin = conversation.get("linear")
            return list(lin) if isinstance(lin, list) else []
        lin = conversation.get("linear") or conversation.get("messages")
        return list(lin) if isinstance(lin, list) else []
    return []


def worker_goal_from_prior_conversation(conversation: list | dict | None, current_effective_goal: str) -> str:
    """Turn prior persisted turns + the latest user goal into one prompt for the ReAct worker."""
    conversation = _linear_conversation_rows(conversation)
    if not conversation:
        return current_effective_goal
    blocks: list[str] = []
    for item in conversation:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        if role == "user":
            blocks.append(f"User:\n{text}")
        elif role == "assistant":
            blocks.append(f"Assistant:\n{text}")
    tail = (current_effective_goal or "").strip()
    if tail:
        blocks.append(f"User:\n{tail}")
    merged = "\n\n---\n\n".join(blocks) if blocks else tail
    return merged[:80_000]


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


async def _clear_run_redis_signal(run_id: str) -> None:
    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    try:
        ch = agent_run_channel(run_id)
        await redis.delete(f"{ch}:terminal")
        await redis.delete(agent_cancel_key(run_id))
    finally:
        await redis.aclose()


async def start_run(
    db: AsyncSession,
    agent_id: str,
    goal: str,
    triggered_by: str,
    attachments: list | None = None,
    model_override: str | None = None,
    replace_run_id: str | None = None,
    continue_run_id: str | None = None,
) -> AgentRun:
    rid_r = (replace_run_id or "").strip()
    cid_c = (continue_run_id or "").strip()
    if rid_r and cid_c:
        raise ValueError("replace_and_continue_exclusive")

    effective = build_effective_goal(goal, attachments)

    if rid_r:
        run = await get_run(db, rid_r)
        if not run or run.agent_id != agent_id:
            raise ValueError("replace_run_id_invalid")
        if run.status == "executing":
            raise ValueError("replace_run_in_progress")

        run.goal = effective
        run.status = "idle"
        run.steps = []
        run.output = None
        run.error = None
        run.total_steps = 0
        run.completed_at = None
        run.started_at = datetime.now(UTC)
        run.triggered_by = triggered_by
        run.feedback = None
        run.conversation = []
        await db.commit()
        await db.refresh(run)
        await _clear_run_redis_signal(run.id)
    elif cid_c:
        run = await get_run(db, cid_c)
        if not run or run.agent_id != agent_id:
            raise ValueError("continue_run_id_invalid")
        if run.status == "executing":
            raise ValueError("continue_run_in_progress")

        run.goal = effective
        run.status = "idle"
        run.steps = []
        run.output = None
        run.error = None
        run.total_steps = 0
        run.completed_at = None
        run.started_at = datetime.now(UTC)
        run.triggered_by = triggered_by
        run.feedback = None
        await db.commit()
        await db.refresh(run)
        await _clear_run_redis_signal(run.id)
    else:
        run = AgentRun(
            agent_id=agent_id,
            goal=effective,
            status="idle",
            triggered_by=triggered_by,
            started_at=datetime.now(UTC),
            conversation=None,
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

    # Use the same Celery app instance as the sandbox worker (`services.sandbox.main:celery_app`)
    # so routing/serialization matches the consumer.
    from services.sandbox.tasks import celery_app as sandbox_celery

    worker_goal = worker_goal_from_prior_conversation(run.conversation, effective)
    kwargs: dict = {"run_id": run.id, "agent_id": agent_id, "goal": worker_goal}
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


async def update_run_conversation(
    db: AsyncSession, run_id: str, conversation: list | dict
) -> AgentRun | None:
    run = await get_run(db, run_id)
    if not run:
        return None
    # Must not call `list(conversation)` when `conversation` is a v2 dict:
    # `list({"v":2,"linear":...,"tree":...})` becomes `["v","linear","tree"]`,
    # wiping branches and breaking BranchPicker after reload.
    run.conversation = list(conversation) if isinstance(conversation, list) else conversation
    await db.commit()
    await db.refresh(run)
    return run


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
