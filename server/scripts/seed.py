"""Seed script — creates default roles and built-in toolkits.

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
from shared.models.toolkit import Toolkit  # noqa: E402

import shared.models.agent  # noqa: F401, E402
import shared.models.embedding  # noqa: F401, E402
import shared.models.session  # noqa: F401, E402
import shared.models.mcp_server  # noqa: F401, E402
import shared.models.toolkit  # noqa: F401, E402

settings = get_settings()

DEFAULT_ROLES = [
    ("super_admin", "Super Administrator — full platform control"),
    ("admin", "Administrator — manage workspaces and users"),
    ("editor", "Editor — create and modify agents"),
    ("viewer", "Viewer — read-only access"),
]

# (name, description, version, category, icon, executor_key)
DEFAULT_TOOLKITS = [
    ("Web Search",       "搜索互联网获取实时信息",     "1.2.0", "search",  "search",    "web_search"),
    ("Code Executor",    "在沙箱中执行代码片段",       "0.9.1", "code",    "code",      "code_executor"),
    ("File Manager",     "读写和管理工作区文件",       "1.0.0", "file",    "folder",    "file_manager"),
    ("API Caller",       "发送 HTTP 请求调用外部 API", "2.1.0", "network", "globe",     "api_caller"),
    ("Text Summarizer",  "对长文本进行智能摘要",       "1.1.0", "nlp",     "file-text", "text_summarizer"),
    ("Image Analyzer",   "分析和描述图片内容",         "0.8.0", "vision",  "image",     "image_analyzer"),
]


async def seed():
    from sqlalchemy import select

    async with async_session_factory() as db:
        for name, desc in DEFAULT_ROLES:
            existing = (await db.execute(select(Role).where(Role.name == name))).scalar_one_or_none()
            if not existing:
                db.add(Role(name=name, description=desc))
                print(f"  + role: {name}")
            else:
                print(f"  = role: {name} (exists)")

        for name, desc, version, category, icon, executor_key in DEFAULT_TOOLKITS:
            existing = (await db.execute(select(Toolkit).where(Toolkit.name == name))).scalar_one_or_none()
            if not existing:
                db.add(Toolkit(
                    name=name, description=desc, version=version,
                    category=category, icon=icon,
                    source="builtin", executor_key=executor_key,
                    is_builtin=True,
                ))
                print(f"  + toolkit: {name} (executor_key={executor_key})")
            else:
                if not existing.executor_key:
                    existing.executor_key = executor_key
                    existing.source = "builtin"
                    print(f"  ~ toolkit: {name} (patched executor_key={executor_key})")
                else:
                    print(f"  = toolkit: {name} (exists)")

        await db.commit()
    print("\nSeed completed.")


if __name__ == "__main__":
    asyncio.run(seed())
