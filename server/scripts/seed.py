"""Seed script — creates default roles and optional admin user.

Usage:
    cd server && uv run python -m scripts.seed
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config import get_settings  # noqa: E402
from shared.database import async_session_factory  # noqa: E402
from shared.models.role import Role  # noqa: E402
from shared.models.user import User  # noqa: E402
from shared.models.workspace import Workspace, WorkspaceMember  # noqa: E402

import shared.models.agent  # noqa: F401, E402
import shared.models.embedding  # noqa: F401, E402
import shared.models.session  # noqa: F401, E402
import shared.models.mcp_server  # noqa: F401, E402

settings = get_settings()

DEFAULT_ROLES = [
    ("super_admin", "Super Administrator — full platform control"),
    ("admin", "Administrator — manage workspaces and users"),
    ("editor", "Editor — create and modify agents"),
    ("viewer", "Viewer — read-only access"),
]


async def seed():
    async with async_session_factory() as db:
        for name, desc in DEFAULT_ROLES:
            from sqlalchemy import select

            existing = (await db.execute(select(Role).where(Role.name == name))).scalar_one_or_none()
            if not existing:
                db.add(Role(name=name, description=desc))
                print(f"  + role: {name}")
            else:
                print(f"  = role: {name} (exists)")
        await db.commit()
    print("\nSeed completed.")


if __name__ == "__main__":
    asyncio.run(seed())
