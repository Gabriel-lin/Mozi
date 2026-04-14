import json
import time

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


# ── LLM Provider / Models ──

OPENROUTER_PROVIDER_MAP: dict[str, str] = {
    "openai": "openai",
    "anthropic": "anthropic",
    "google": "google",
    "deepseek": "deepseek",
    "zhipu": "zhipu",
    "moonshot": "moonshot",
    "qwen": "qwen",
}


async def _fetch_models_from_openrouter(provider: str) -> list[dict] | None:
    """Tier-1: Fetch models from OpenRouter free API, filtered by provider prefix."""
    import httpx

    prefix = OPENROUTER_PROVIDER_MAP.get(provider)
    if not prefix:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://openrouter.ai/api/v1/models")
            resp.raise_for_status()
            data = resp.json()
            results: list[dict] = []
            for m in data.get("data", []):
                mid: str = m.get("id", "")
                if not mid.startswith(f"{prefix}/"):
                    continue
                short_id = mid.split("/", 1)[1]
                results.append({
                    "id": short_id,
                    "name": m.get("name", short_id),
                    "context_length": m.get("context_length"),
                })
            return results if results else None
    except Exception:
        return None


async def _fetch_models_from_provider(
    provider: str,
    api_key: str | None = None,
    api_base: str | None = None,
) -> list[dict] | None:
    """Tier-2: Fetch models from the provider's own API (requires api_key)."""
    import httpx

    if provider == "ollama":
        base = (api_base or "http://localhost:11434").rstrip("/")
        url = f"{base}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                models = data.get("models", [])
                return [{"id": m["name"], "name": m["name"]} for m in models]
        except Exception:
            return None

    if not api_key:
        return None

    if provider == "google":
        base = (api_base or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        url = f"{base}/models?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                models = data.get("models", [])
                return [
                    {"id": m["name"].split("/")[-1], "name": m.get("displayName", m["name"])}
                    for m in models
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
        except Exception:
            return None

    if provider == "anthropic":
        base = (api_base or "https://api.anthropic.com/v1").rstrip("/")
        url = f"{base}/models"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                models = data.get("data", [])
                return [{"id": m["id"], "name": m.get("display_name", m["id"])} for m in models]
        except Exception:
            return None

    # OpenAI-compatible: openai, deepseek, zhipu, moonshot, qwen
    api_endpoints: dict[str, str] = {
        "openai": "https://api.openai.com/v1/models",
        "deepseek": "https://api.deepseek.com/v1/models",
        "zhipu": "https://open.bigmodel.cn/api/paas/v4/models",
        "moonshot": "https://api.moonshot.cn/v1/models",
        "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
    }
    default_base = api_endpoints.get(provider, "https://api.openai.com/v1/models")
    if api_base:
        base = api_base.rstrip("/")
        url = f"{base}/models"
    else:
        url = default_base
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            models = data.get("data", [])
            return [{"id": m["id"], "name": m.get("name", m["id"])} for m in models]
    except Exception:
        return None


@router.get("/llm/providers/models")
async def list_provider_models(
    provider: str = Query(..., description="Provider id"),
    api_key: str | None = Query(None, description="Optional API key to fetch live models"),
    api_base: str | None = Query(None, description="Optional custom API base URL"),
):
    """Three-tier model discovery: provider API → OpenRouter → empty (frontend fallback)."""
    # Tier 1: if user provided api_key, try the provider's own API first (most accurate)
    if api_key or provider == "ollama":
        direct = await _fetch_models_from_provider(provider, api_key, api_base)
        if direct:
            return {"provider": provider, "models": direct, "source": "live"}

    # Tier 2: OpenRouter free API (no auth needed, covers major providers)
    openrouter = await _fetch_models_from_openrouter(provider)
    if openrouter:
        return {"provider": provider, "models": openrouter, "source": "openrouter"}

    # Tier 3: empty → frontend uses its FALLBACK_MODELS
    return {"provider": provider, "models": [], "source": "none"}


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


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Request cancellation of a running workflow via Redis signal + DB fallback."""
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(404, "Not found")
    if run.status not in ("pending", "running"):
        return {"success": True, "status": run.status, "message": "Run already finished"}

    redis = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis.set(f"workflow:cancel:{run_id}", "1", ex=600)
    finally:
        await redis.aclose()

    from datetime import datetime, timezone

    await service.update_run_status(
        db, run_id, "cancelled",
        error="用户取消",
        completed_at=datetime.now(timezone.utc),
    )

    channel = f"workflow:run:{run_id}"
    redis2 = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    try:
        payload = json.dumps({"type": "run_cancelled", "timestamp": int(time.time() * 1000)})
        await redis2.publish(channel, payload)
        await redis2.set(f"{channel}:terminal", payload, ex=3600)
    finally:
        await redis2.aclose()

    return {"success": True, "status": "cancelled"}


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
