from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from shared.schemas.agent import (
    AgentCreate, AgentListOut, AgentOut, AgentUpdate,
    RunCreate, RunListOut, RunOut,
)
from services.workspace.service import is_workspace_member, get_member_role
from . import service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/", response_model=AgentListOut)
async def list_agents(
    workspace_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_workspace_member(db, workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    agents, total, p, ps = await service.list_agents(db, workspace_id, page, page_size)
    return AgentListOut(
        agents=[AgentOut.model_validate(a) for a in agents], total=total, page=p, page_size=ps
    )


@router.post("/", response_model=AgentOut, status_code=201)
async def create_agent(
    body: AgentCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not await is_workspace_member(db, body.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    agent = await service.create_agent(db, user.id, body.model_dump())
    return AgentOut.model_validate(agent)


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    return AgentOut.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: str, body: AgentUpdate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, agent.workspace_id, user.id)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(403, "Forbidden")
    updated = await service.update_agent(db, agent_id, body.model_dump(exclude_unset=True))
    return AgentOut.model_validate(updated)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, agent.workspace_id, user.id)
    if role not in ("owner", "admin"):
        raise HTTPException(403, "Forbidden")
    await service.delete_agent(db, agent_id)
    return {"success": True}


@router.post("/{agent_id}/run", response_model=RunOut, status_code=201)
async def start_run(
    agent_id: str, body: RunCreate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    run = await service.start_run(db, agent_id, body.goal, user.id)
    return RunOut.model_validate(run)


@router.get("/{agent_id}/runs", response_model=RunListOut)
async def list_runs(
    agent_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    runs, total, p, ps = await service.list_runs(db, agent_id, page, page_size)
    return RunListOut(runs=[RunOut.model_validate(r) for r in runs], total=total, page=p, page_size=ps)


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    return RunOut.model_validate(run)
