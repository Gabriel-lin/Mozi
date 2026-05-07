import asyncio
import json
import time

import structlog
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from redis.asyncio import Redis as AsyncRedis
from shared.config import get_settings
from shared.database import async_session_factory, get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from shared.schemas.agent import (
    AgentCreate,
    AgentDetailOut,
    AgentListOut,
    AgentOut,
    AgentUpdate,
    RunConversationPatch,
    RunCreate,
    RunFeedbackBody,
    RunListOut,
    RunOut,
    RunPinBody,
)
from shared.schemas.skills import AgentSkillCatalogOut, CreateLocalSkillIn, SkillSourceOut
from shared.security import verify_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.sandbox.agent_run_pub import agent_cancel_key, agent_run_channel
from services.workspace.service import get_member_role, is_workspace_member

from . import service, skills_fs

log = structlog.get_logger()
settings = get_settings()

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


@router.post("/{agent_id}/run", response_model=RunOut)
async def start_run(
    agent_id: str,
    body: RunCreate,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    try:
        run = await service.start_run(
            db,
            agent_id,
            body.goal,
            user.id,
            body.attachments,
            body.model,
            body.replace_run_id,
            body.continue_run_id,
        )
    except ValueError as exc:
        msg = str(exc)
        if msg == "replace_run_id_invalid":
            raise HTTPException(400, "Invalid replace_run_id for this agent.") from exc
        if msg == "replace_run_in_progress":
            raise HTTPException(409, "Run is still executing; cancel before replacing.") from exc
        if msg == "continue_run_id_invalid":
            raise HTTPException(400, "Invalid continue_run_id for this agent.") from exc
        if msg == "continue_run_in_progress":
            raise HTTPException(409, "Run is still executing; cancel before continuing.") from exc
        if msg == "replace_and_continue_exclusive":
            raise HTTPException(400, "Cannot set both replace_run_id and continue_run_id.") from exc
        raise
    response.status_code = 200 if (body.replace_run_id or body.continue_run_id) else 201
    return RunOut.model_validate(run)


@router.get("/{agent_id}/runs", response_model=RunListOut)
async def list_runs(
    agent_id: str,
    response: Response,
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
    response.headers["Cache-Control"] = "no-store"
    return RunListOut(runs=[RunOut.model_validate(r) for r in runs], total=total, page=p, page_size=ps)


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(run_id: str, response: Response, db: AsyncSession = Depends(get_db)):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    response.headers["Cache-Control"] = "no-store"
    return RunOut.model_validate(run)


@router.patch("/runs/{run_id}/conversation", response_model=RunOut)
async def patch_run_conversation(
    run_id: str,
    body: RunConversationPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    agent = await service.get_agent(db, run.agent_id)
    if not agent or not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    updated = await service.update_run_conversation(db, run_id, body.conversation)
    if not updated:
        raise HTTPException(404, "Not found")
    return RunOut.model_validate(updated)


@router.post("/runs/{run_id}/cancel")
async def cancel_agent_run(
    run_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    agent = await service.get_agent(db, run.agent_id)
    if not agent or not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis.set(agent_cancel_key(run_id), "1", ex=600)
        cancel_evt = {
            "type": "cancel_requested",
            "run_id": run_id,
            "timestamp": int(time.time() * 1000),
        }
        await redis.publish(agent_run_channel(run_id), json.dumps(cancel_evt))
    finally:
        await redis.aclose()
    return {"success": True}


@router.delete("/runs/{run_id}", status_code=204)
async def delete_agent_run(
    run_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    agent = await service.get_agent(db, run.agent_id)
    if not agent or not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    ok = await service.delete_run(db, run_id)
    if not ok:
        raise HTTPException(404, "Not found")


@router.post("/runs/{run_id}/pin", response_model=RunOut)
async def pin_agent_run(
    run_id: str,
    body: RunPinBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    agent = await service.get_agent(db, run.agent_id)
    if not agent or not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    updated = await service.set_run_pinned(db, run_id, body.pinned)
    if not updated:
        raise HTTPException(404, "Not found")
    return RunOut.model_validate(updated)


@router.post("/runs/{run_id}/feedback", response_model=RunOut)
async def feedback_agent_run(
    run_id: str,
    body: RunFeedbackBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    agent = await service.get_agent(db, run.agent_id)
    if not agent or not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    updated = await service.set_run_feedback(db, run_id, body.feedback)
    if not updated:
        raise HTTPException(404, "Not found")
    return RunOut.model_validate(updated)


@router.websocket("/runs/{run_id}/ws")
async def agent_run_websocket(websocket: WebSocket, run_id: str, token: str | None = Query(None)):
    """Subscribe to agent run events (Redis channel ``agent:run:{run_id}``).

    Authenticate with ``?token=<JWT>`` (same access token as REST). Client may send
    ``{"action": "cancel"}`` to request cooperative cancellation.
    """
    if not token:
        await websocket.close(code=4401)
        return
    user_id = verify_token(token)
    if not user_id:
        await websocket.close(code=4401)
        return

    async with async_session_factory() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user:
            await websocket.close(code=4401)
            return
        run = await service.get_run(db, run_id)
        if not run:
            await websocket.close(code=1008)
            return
        agent = await service.get_agent(db, run.agent_id)
        if not agent or not await is_workspace_member(db, agent.workspace_id, user.id):
            await websocket.close(code=1008)
            return

    await websocket.accept()
    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    channel = agent_run_channel(run_id)
    try:
        await pubsub.subscribe(channel)
        log.info("agent_ws_subscribed", run_id=run_id, channel=channel)

        terminal = await redis.get(f"{channel}:terminal")
        if terminal:
            await websocket.send_text(terminal)
            return

        terminal_key = f"{channel}:terminal"

        async def _relay_events():
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    await websocket.send_text(msg["data"])
                    try:
                        data = json.loads(msg["data"])
                    except json.JSONDecodeError:
                        pass
                    else:
                        if data.get("type") in ("run_completed", "run_failed", "run_stopped"):
                            return
                else:
                    # PUB/SUB can race with subscribe; terminal is also stored on this key.
                    cached = await redis.get(terminal_key)
                    if cached:
                        await websocket.send_text(cached)
                        return
                await asyncio.sleep(0.05)

        async def _handle_client():
            try:
                while True:
                    raw = await websocket.receive_text()
                    try:
                        cmd = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if cmd.get("action") == "cancel":
                        await redis.set(agent_cancel_key(run_id), "1", ex=600)
                        log.info("agent_ws_cancel_requested", run_id=run_id)
            except WebSocketDisconnect:
                pass

        relay_task = asyncio.create_task(_relay_events())
        client_task = asyncio.create_task(_handle_client())
        done, pending = await asyncio.wait(
            [relay_task, client_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        log.info("agent_ws_disconnected", run_id=run_id)
    except Exception as exc:
        log.error("agent_ws_error", run_id=run_id, error=str(exc))
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis.aclose()
