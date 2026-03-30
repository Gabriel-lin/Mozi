from celery import Celery
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import get_settings
from shared.models.agent import Agent, AgentRun

settings = get_settings()
celery_app = Celery("mozi", broker=settings.redis_url)


async def create_agent(db: AsyncSession, created_by: str, data: dict) -> Agent:
    agent = Agent(created_by=created_by, **data)
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


async def start_run(db: AsyncSession, agent_id: str, goal: str, triggered_by: str) -> AgentRun:
    from datetime import datetime, timezone

    run = AgentRun(
        agent_id=agent_id,
        goal=goal,
        status="idle",
        triggered_by=triggered_by,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    celery_app.send_task(
        "services.sandbox.tasks.execute_agent_run",
        kwargs={"run_id": run.id, "agent_id": agent_id, "goal": goal},
        queue="agent-runs",
    )
    return run


async def get_run(db: AsyncSession, run_id: str) -> AgentRun | None:
    result = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    return result.scalar_one_or_none()


async def list_runs(db: AsyncSession, agent_id: str, page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    query = select(AgentRun).where(AgentRun.agent_id == agent_id).order_by(desc(AgentRun.created_at))
    count_q = select(func.count()).select_from(AgentRun).where(AgentRun.agent_id == agent_id)

    result = await db.execute(query.offset(offset).limit(page_size))
    total = (await db.execute(count_q)).scalar_one()
    return result.scalars().all(), total, page, page_size
