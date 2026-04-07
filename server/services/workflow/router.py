import json

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import get_settings
from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from shared.schemas.workflow import (
    WorkflowCreate, WorkflowListOut, WorkflowOut, WorkflowUpdate,
    VersionCreate, VersionListOut, VersionOut,
    RunCreate, RunListOut, RunOut,
    WorkflowValidationError,
)
from services.workspace.service import is_workspace_member, get_member_role
from .validator import validate_workflow
from . import service

log = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/workflows", tags=["workflows"])


# ── Workflows CRUD ──


@router.get("/", response_model=WorkflowListOut)
async def list_workflows(
    workspace_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_workspace_member(db, workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    workflows, total, p, ps = await service.list_workflows(db, workspace_id, page, page_size)
    return WorkflowListOut(
        workflows=[WorkflowOut.model_validate(w) for w in workflows],
        total=total, page=p, page_size=ps,
    )


@router.post("/", response_model=WorkflowOut, status_code=201)
async def create_workflow(
    body: WorkflowCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_workspace_member(db, body.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    workflow = await service.create_workflow(db, user.id, body.model_dump())
    return WorkflowOut.model_validate(workflow)


@router.get("/{workflow_id}", response_model=WorkflowOut)
async def get_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, workflow.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    return WorkflowOut.model_validate(workflow)


@router.patch("/{workflow_id}", response_model=WorkflowOut)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, workflow.workspace_id, user.id)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(403, "Forbidden")
    updated = await service.update_workflow(db, workflow_id, body.model_dump(exclude_unset=True))
    return WorkflowOut.model_validate(updated)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, workflow.workspace_id, user.id)
    if role not in ("owner", "admin"):
        raise HTTPException(403, "Forbidden")
    await service.delete_workflow(db, workflow_id)
    return {"success": True}


# ── Versions ──


@router.get("/{workflow_id}/versions", response_model=VersionListOut)
async def list_versions(
    workflow_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, workflow.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    versions, total, p, ps = await service.list_versions(db, workflow_id, page, page_size)
    return VersionListOut(
        versions=[VersionOut.model_validate(v) for v in versions],
        total=total, page=p, page_size=ps,
    )


@router.post("/{workflow_id}/versions", response_model=VersionOut, status_code=201)
async def create_version(
    workflow_id: str,
    body: VersionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    role = await get_member_role(db, workflow.workspace_id, user.id)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(403, "Forbidden")
    version = await service.create_version(db, workflow_id, user.id, body.model_dump())
    return VersionOut.model_validate(version)


@router.get("/versions/{version_id}", response_model=VersionOut)
async def get_version(
    version_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    version = await service.get_version(db, version_id)
    if not version:
        raise HTTPException(404, "Not found")
    workflow = await service.get_workflow(db, version.workflow_id)
    if not workflow or not await is_workspace_member(db, workflow.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    return VersionOut.model_validate(version)


# ── Runs ──


@router.post(
    "/{workflow_id}/run",
    response_model=RunOut,
    status_code=201,
    responses={422: {"model": WorkflowValidationError}},
)
async def start_run(
    workflow_id: str,
    body: RunCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, workflow.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")

    version = await service.get_latest_version(db, workflow_id)
    if not version or not version.graph_data:
        raise HTTPException(400, "工作流没有可执行的版本，请先保存")

    validation = validate_workflow(version.graph_data)
    if not validation.valid:
        raise HTTPException(422, detail={
            "detail": "工作流验证失败",
            "errors": validation.errors,
        })

    run_data = body.model_dump(exclude_unset=True)
    run_data["version_id"] = version.id
    run = await service.create_run(db, workflow_id, user.id, run_data)

    from .worker import execute_workflow_run
    execute_workflow_run.delay(run.id)

    return RunOut.model_validate(run)


@router.get("/{workflow_id}/runs", response_model=RunListOut)
async def list_runs(
    workflow_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(404, "Not found")
    if not await is_workspace_member(db, workflow.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    runs, total, p, ps = await service.list_runs(db, workflow_id, page, page_size)
    return RunListOut(
        runs=[RunOut.model_validate(r) for r in runs],
        total=total, page=p, page_size=ps,
    )


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    return RunOut.model_validate(run)


# ── WebSocket: real-time run progress ──


@router.websocket("/runs/{run_id}/ws")
async def run_websocket(websocket: WebSocket, run_id: str):
    """Subscribe to workflow run progress events via WebSocket.

    The WebSocket relays events from Redis Pub/Sub channel `workflow:run:{run_id}`.
    Client can send JSON messages with `{"action": "cancel"}` to request cancellation.
    """
    await websocket.accept()

    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    channel = f"workflow:run:{run_id}"

    try:
        await pubsub.subscribe(channel)
        log.info("ws_subscribed", run_id=run_id, channel=channel)

        # Race-condition guard: if the worker already finished before we
        # subscribed, Pub/Sub messages are lost. Check the cached terminal event.
        terminal = await redis.get(f"{channel}:terminal")
        if terminal:
            log.info("ws_terminal_cached", run_id=run_id)
            await websocket.send_text(terminal)
            return

        import asyncio

        async def _relay_events():
            """Forward Redis Pub/Sub messages to the WebSocket client."""
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    await websocket.send_text(msg["data"])
                    data = json.loads(msg["data"])
                    if data.get("type") in ("run_completed", "run_failed", "run_cancelled"):
                        return
                await asyncio.sleep(0.05)

        async def _handle_client():
            """Listen for client commands (cancel, pause)."""
            try:
                while True:
                    raw = await websocket.receive_text()
                    try:
                        cmd = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if cmd.get("action") == "cancel":
                        await redis.set(
                            f"workflow:cancel:{run_id}", "1", ex=600,
                        )
                        log.info("ws_cancel_requested", run_id=run_id)
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
        log.info("ws_disconnected", run_id=run_id)
    except Exception as exc:
        log.error("ws_error", run_id=run_id, error=str(exc))
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis.aclose()
