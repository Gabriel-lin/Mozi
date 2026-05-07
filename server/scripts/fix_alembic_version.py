"""Set alembic_version when DB points at a removed revision (e.g. e9b2c3d04f32).

Alembic refuses to run until version_num exists in ./alembic/versions. Use this once,
then: PYTHONPATH=. uv run alembic upgrade head

Usage (from server/):
  PYTHONPATH=. uv run python scripts/fix_alembic_version.py
  PYTHONPATH=. uv run python scripts/fix_alembic_version.py c5f1a2e03d14
"""

from __future__ import annotations

import argparse
import asyncio

from shared.config import get_settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main(revision: str) -> None:
    eng = create_async_engine(get_settings().database_url)
    async with eng.begin() as conn:
        r = await conn.execute(text("SELECT version_num FROM alembic_version"))
        rows = r.fetchall()
        if not rows:
            await conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:r)"),
                {"r": revision},
            )
        else:
            await conn.execute(
                text("UPDATE alembic_version SET version_num = :r"),
                {"r": revision},
            )
    await eng.dispose()
    print(f"alembic_version -> {revision!r} (had {len(rows)} row(s))")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "revision",
        nargs="?",
        default="d8a3c1b04e21",
        help="Target revision id (default: current repo head)",
    )
    args = p.parse_args()
    asyncio.run(main(args.revision))
