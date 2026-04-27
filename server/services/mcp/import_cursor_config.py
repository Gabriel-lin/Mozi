"""Import MCP server definitions from a Cursor-style ~/.Mozi/mcp.json `mcpServers` object."""

from __future__ import annotations

import json
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.mcp_server import McpServer

log = structlog.get_logger()


def normalize_mcp_servers_block(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse top-level JSON that contains `mcpServers` like Cursor / Claude config."""
    out: list[dict[str, Any]] = []
    servers = raw.get("mcpServers")
    if not isinstance(servers, dict):
        return out
    for logical_name, spec in servers.items():
        if not isinstance(spec, dict):
            continue
        name = str(logical_name).strip()[:100]
        if not name:
            continue
        url = spec.get("url")
        if isinstance(url, str) and url.strip():
            out.append(
                {
                    "name": name,
                    "transport": "streamable_http",
                    "url": url.strip()[:500],
                    "auth_type": spec.get("auth_type") if isinstance(spec.get("auth_type"), str) else None,
                    "definition": dict(spec),
                },
            )
            continue
        cmd = spec.get("command")
        if isinstance(cmd, str) and cmd.strip():
            out.append(
                {
                    "name": name,
                    "transport": "stdio",
                    "url": None,
                    "auth_type": None,
                    "definition": dict(spec),
                },
            )
            continue
        log.warning("mcp_json_skip_entry", name=name, reason="no_url_or_command")
    return out


async def import_cursor_mcp_config(
    db: AsyncSession,
    workspace_id: str,
    raw: dict[str, Any],
) -> tuple[list[McpServer], list[str]]:
    """Upsert MCP rows for this workspace from Cursor-style config. Returns (servers, errors)."""
    entries = normalize_mcp_servers_block(raw)
    errors: list[str] = []
    saved: list[McpServer] = []

    for entry in entries:
        name = entry["name"]
        try:
            result = await db.execute(
                select(McpServer).where(
                    McpServer.workspace_id == workspace_id,
                    McpServer.name == name,
                ),
            )
            existing = result.scalar_one_or_none()
            definition_str = json.dumps(entry["definition"], ensure_ascii=False)
            if existing:
                existing.transport = entry["transport"]
                existing.url = entry["url"]
                existing.auth_type = entry.get("auth_type")
                if entry["transport"] == "stdio":
                    existing.auth_credential = None
                existing.definition_json = definition_str
                existing.is_active = True
                await db.commit()
                await db.refresh(existing)
                saved.append(existing)
            else:
                row = McpServer(
                    name=name,
                    url=entry["url"],
                    transport=entry["transport"],
                    auth_type=entry.get("auth_type"),
                    auth_credential=None,
                    workspace_id=workspace_id,
                    is_active=True,
                    definition_json=definition_str,
                )
                db.add(row)
                try:
                    await db.commit()
                    await db.refresh(row)
                    saved.append(row)
                except IntegrityError:
                    await db.rollback()
                    result2 = await db.execute(
                        select(McpServer).where(
                            McpServer.workspace_id == workspace_id,
                            McpServer.name == name,
                        ),
                    )
                    race = result2.scalar_one_or_none()
                    if not race:
                        errors.append(f"{name}: concurrent insert failed")
                        continue
                    race.transport = entry["transport"]
                    race.url = entry["url"]
                    race.auth_type = entry.get("auth_type")
                    if entry["transport"] == "stdio":
                        race.auth_credential = None
                    race.definition_json = definition_str
                    race.is_active = True
                    await db.commit()
                    await db.refresh(race)
                    saved.append(race)
        except Exception as e:  # noqa: BLE001
            await db.rollback()
            errors.append(f"{name}: {e!s}")
            log.exception("mcp_import_entry_failed", name=name)

    return saved, errors
