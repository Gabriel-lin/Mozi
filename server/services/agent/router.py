from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from shared.schemas.agent import (
    AgentCreate,
    AgentDetailOut,
    AgentListOut,
    AgentOut,
    AgentUpdate,
    RunCreate,
    RunListOut,
    RunOut,
)
from shared.schemas.skills import AgentSkillCatalogOut, CreateLocalSkillIn, SkillSourceOut
from services.workspace.service import is_workspace_member, get_member_role
from . import service
from . import skills_fs

router = APIRouter(prefix="/agents", tags=["agents"])


def _merge_agent_skill_id_into_config(cfg: object, skill_id: str) -> dict:
    c = {**(cfg or {})} if isinstance(cfg, dict) else {}
    raw = c.get("skills")
    skills_list = [str(x) for x in raw] if isinstance(raw, list) else []
    if skill_id not in skills_list:
        skills_list = [*skills_list, skill_id]
    c["skills"] = skills_list
    return c


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
    agent = await service.create_agent(db, user.id, body.model_dump(exclude_none=True))
    return AgentOut.model_validate(agent)


@router.post("/{agent_id}/skills/create-local", response_model=AgentSkillCatalogOut, status_code=201)
async def create_local_agent_skill(
    agent_id: str,
    body: CreateLocalSkillIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, agent.workspace_id, user.id)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(403, "Forbidden")
    try:
        new_path = skills_fs.create_local_mozi_skill(body.name, body.title, body.description)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileExistsError:
        raise HTTPException(409, "Skill id already exists") from None
    except OSError as e:
        raise HTTPException(500, f"Failed to create skill: {e}") from e
    skill_id = new_path.name
    await service.update_agent(
        db, agent_id, {"config": _merge_agent_skill_id_into_config(agent.config, skill_id)}
    )
    agent2 = await service.get_agent(db, agent_id)
    assert agent2 is not None
    items_raw, selected = skills_fs.build_catalog((agent2.config or {}).get("skills"))
    return AgentSkillCatalogOut(
        items=[SkillSourceOut.model_validate(x) for x in items_raw], selected=selected
    )


@router.post("/{agent_id}/skills/import", response_model=AgentSkillCatalogOut, status_code=201)
async def import_agent_skill_folder(
    agent_id: str,
    skill_id: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, agent.workspace_id, user.id)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(403, "Forbidden")
    if not files:
        raise HTTPException(400, "No files uploaded")
    names = [f.filename for f in files]
    relpaths = skills_fs.relpaths_from_webkit_names(names)
    if len(relpaths) != len(files):
        relpaths = [str(n or "").replace("\\", "/") for n in names]
    pairs: list[tuple[str, bytes]] = []
    if len(relpaths) != len(files):
        raise HTTPException(400, "Path / file list mismatch")
    for f, rel in zip(files, relpaths):
        raw = await f.read()
        pairs.append((rel, raw))
    sid = (skill_id or "").strip()
    if not sid and names:
        first = str(names[0] or "").replace("\\", "/").strip()
        if "/" in first:
            sid = first.split("/")[0]
    if not sid:
        raise HTTPException(400, "skill_id is required (or select a folder with a name)")
    try:
        new_path = skills_fs.import_mozi_file_pairs(sid, pairs)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileExistsError:
        raise HTTPException(409, "Skill id already exists on server") from None
    except OSError as e:
        raise HTTPException(500, f"Failed to import: {e}") from e
    out_id = new_path.name
    await service.update_agent(
        db, agent_id, {"config": _merge_agent_skill_id_into_config(agent.config, out_id)}
    )
    agent2 = await service.get_agent(db, agent_id)
    assert agent2 is not None
    items_raw, selected = skills_fs.build_catalog((agent2.config or {}).get("skills"))
    return AgentSkillCatalogOut(
        items=[SkillSourceOut.model_validate(x) for x in items_raw], selected=selected
    )


@router.post("/{agent_id}/skills/import-zip", response_model=AgentSkillCatalogOut, status_code=201)
async def import_agent_skill_zip(
    agent_id: str,
    file: UploadFile = File(...),
    skill_id: str = Form(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, agent.workspace_id, user.id)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(403, "Forbidden")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    sid = (skill_id or "").strip()
    if not sid:
        raise HTTPException(400, "skill_id is required for zip import")
    try:
        new_path = skills_fs.import_mozi_zip_file(sid, raw)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileExistsError:
        raise HTTPException(409, "Skill id already exists on server") from None
    except OSError as e:
        raise HTTPException(500, f"Failed to import: {e}") from e
    out_id = new_path.name
    await service.update_agent(
        db, agent_id, {"config": _merge_agent_skill_id_into_config(agent.config, out_id)}
    )
    agent2 = await service.get_agent(db, agent_id)
    assert agent2 is not None
    items_raw, selected = skills_fs.build_catalog((agent2.config or {}).get("skills"))
    return AgentSkillCatalogOut(
        items=[SkillSourceOut.model_validate(x) for x in items_raw], selected=selected
    )


@router.get("/{agent_id}", response_model=AgentDetailOut)
async def get_agent(
    agent_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    base = AgentOut.model_validate(agent)
    raw = (agent.config or {}).get("skills")
    items_raw, selected = skills_fs.build_catalog(raw)
    return AgentDetailOut(
        **base.model_dump(),
        skill_catalog=AgentSkillCatalogOut(
            items=[SkillSourceOut.model_validate(x) for x in items_raw], selected=selected
        ),
    )


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
