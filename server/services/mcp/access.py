"""Workspace membership checks for MCP gateway routes (shared DB)."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.workspace import WorkspaceMember


async def require_workspace_member(db: AsyncSession, workspace_id: str, user_id: str) -> None:
    r = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        ),
    )
    if r.scalar_one_or_none() is None:
        raise HTTPException(403, "Forbidden")
