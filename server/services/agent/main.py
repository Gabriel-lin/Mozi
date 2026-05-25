from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.config import get_settings
from shared.database import async_session_factory

from .langgraph_router import router as langgraph_router
from .langgraph_runtime import init_checkpointer, shutdown_checkpointer
from .langgraph_runtime.threads import ensure_thread_schema
from .router import router

log = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Boot the LangGraph PostgresSaver and thread metadata table once."""
    try:
        await init_checkpointer()
        async with async_session_factory() as session:
            await ensure_thread_schema(session)
        log.info("agent_service_lifespan_started")
    except Exception as exc:  # pragma: no cover
        log.error("agent_service_lifespan_init_failed", error=str(exc))
        # Re-raise so a misconfigured Postgres surfaces immediately.
        raise
    try:
        yield
    finally:
        await shutdown_checkpointer()
        log.info("agent_service_lifespan_stopped")


app = FastAPI(title="Mozi Agent Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1")
app.include_router(langgraph_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("services.agent.main:app", host="0.0.0.0", port=3003, reload=settings.debug)
