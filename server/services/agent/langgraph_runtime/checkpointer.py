"""Process-scoped :class:`AsyncPostgresSaver` lifecycle.

LangGraph's :class:`AsyncPostgresSaver` opens a long-lived ``AsyncConnectionPool``
(``psycopg_pool``) that must be entered/exited explicitly. We initialise one
saver per worker on FastAPI startup and reuse it across requests; this avoids
per-request connection churn and lets the agent share Postgres checkpoints.

Postgres URL handling: the rest of the codebase uses the SQLAlchemy DSN
``postgresql+asyncpg://...``. ``psycopg`` requires the canonical
``postgresql://`` scheme, so we normalise it here.
"""

from __future__ import annotations

import asyncio
import contextlib
from urllib.parse import urlsplit, urlunsplit

import structlog
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from shared.config import get_settings

log = structlog.get_logger()
settings = get_settings()


_lock = asyncio.Lock()
_pool: AsyncConnectionPool | None = None
_saver: AsyncPostgresSaver | None = None
_setup_done = False


def _normalize_dsn(dsn: str) -> str:
    """Strip SQLAlchemy ``+asyncpg`` / ``+psycopg`` driver suffix for psycopg."""
    parts = urlsplit(dsn)
    scheme = parts.scheme.split("+", 1)[0] or "postgresql"
    # psycopg accepts "postgresql" or "postgres"; normalise to "postgresql".
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql"
    return urlunsplit((scheme, parts.netloc, parts.path, parts.query, parts.fragment))


async def init_checkpointer() -> AsyncPostgresSaver:
    """Initialise the shared :class:`AsyncPostgresSaver`.

    Idempotent — safe to call multiple times (e.g. FastAPI lifespan + lazy access).
    Performs schema migration via :meth:`AsyncPostgresSaver.setup` on first call.
    """
    global _pool, _saver, _setup_done

    async with _lock:
        if _saver is not None:
            return _saver

        dsn = _normalize_dsn(settings.database_url)
        # ``psycopg`` AsyncConnectionPool requires ``open=False`` when constructed
        # outside an event loop or before ``__aenter__``; we open explicitly to
        # surface errors at startup rather than on the first checkpoint write.
        pool = AsyncConnectionPool(
            conninfo=dsn,
            max_size=20,
            min_size=2,
            kwargs={"autocommit": True, "prepare_threshold": 0},
            open=False,
        )
        await pool.open(wait=True, timeout=30)
        saver = AsyncPostgresSaver(pool)  # type: ignore[arg-type]

        if not _setup_done:
            try:
                await saver.setup()
                _setup_done = True
                log.info("langgraph_checkpointer_setup", dsn_host=urlsplit(dsn).hostname)
            except Exception as exc:  # pragma: no cover
                log.error("langgraph_checkpointer_setup_failed", error=str(exc))
                await pool.close()
                raise

        _pool = pool
        _saver = saver
        return saver


async def shutdown_checkpointer() -> None:
    """Close the shared connection pool. Called from FastAPI lifespan shutdown."""
    global _pool, _saver

    async with _lock:
        saver = _saver
        pool = _pool
        _saver = None
        _pool = None

    if pool is not None:
        with contextlib.suppress(Exception):
            await pool.close()
        log.info("langgraph_checkpointer_closed")
    # Saver holds no resources beyond the pool.
    _ = saver


async def get_checkpointer() -> AsyncPostgresSaver:
    """Return the shared checkpointer, initialising it on demand."""
    if _saver is None:
        return await init_checkpointer()
    return _saver
