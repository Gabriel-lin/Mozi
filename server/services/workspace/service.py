from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.user import User
from shared.models.role import Role, UserRole
from shared.models.workspace import Workspace, WorkspaceMember
from shared.models.toolkit import Toolkit, WorkspaceToolkit


async def list_users(db: AsyncSession, page: int = 1, page_size: int = 20, search: str | None = None):
    offset = (page - 1) * page_size
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        query = query.where(User.email.ilike(f"%{search}%"))
        count_query = count_query.where(User.email.ilike(f"%{search}%"))

    query = query.order_by(desc(User.created_at)).offset(offset).limit(page_size)

    result = await db.execute(query)
    total_result = await db.execute(count_query)

    return result.scalars().all(), total_result.scalar_one(), page, page_size


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user_id: str, data: dict) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_roles(db: AsyncSession, user_id: str):
    result = await db.execute(
        select(Role, UserRole.assigned_at)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    return result.all()


async def assign_role(db: AsyncSession, user_id: str, role_id: str):
    existing = await db.execute(
        select(UserRole).where(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
    )
    if existing.scalar_one_or_none():
        return
    db.add(UserRole(user_id=user_id, role_id=role_id))
    await db.commit()


async def remove_role(db: AsyncSession, user_id: str, role_id: str):
    result = await db.execute(
        select(UserRole).where(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()


async def create_workspace(db: AsyncSession, owner_id: str, data: dict) -> Workspace:
    slug = data.get("slug") or _make_slug(data.get("name", "workspace"))
    existing = await db.execute(select(Workspace).where(Workspace.slug == slug))
    if existing.scalar_one_or_none():
        import secrets
        slug = f"{slug}-{secrets.token_hex(3)}"
    data["slug"] = slug
    ws = Workspace(owner_id=owner_id, **data)
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=owner_id, role="owner"))
    await db.commit()
    await db.refresh(ws)
    return ws


def _make_slug(name: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:50] or "workspace"


async def ensure_default_workspace(db: AsyncSession, user_id: str) -> None:
    count = await db.execute(
        select(func.count())
        .select_from(WorkspaceMember)
        .where(WorkspaceMember.user_id == user_id)
    )
    if count.scalar_one() > 0:
        return
    ws = await create_workspace(db, user_id, {
        "name": "本地工作区",
        "type": "local",
        "path": "~/workspace",
    })
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user and not user.active_workspace_id:
        user.active_workspace_id = ws.id
        await db.commit()


async def set_active_workspace(db: AsyncSession, user: User, workspace_id: str) -> None:
    user.active_workspace_id = workspace_id
    await db.commit()


async def get_user_workspaces(db: AsyncSession, user_id: str):
    await ensure_default_workspace(db, user_id)
    result = await db.execute(
        select(Workspace, WorkspaceMember.role, WorkspaceMember.joined_at)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(desc(Workspace.created_at))
    )
    return result.all()


async def get_workspace_by_id(db: AsyncSession, workspace_id: str) -> Workspace | None:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    return result.scalar_one_or_none()


async def update_workspace(db: AsyncSession, workspace_id: str, data: dict) -> Workspace | None:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(ws, key, value)
    await db.commit()
    await db.refresh(ws)
    return ws


async def delete_workspace(db: AsyncSession, workspace_id: str, owner_id: str):
    count = await db.execute(
        select(func.count())
        .select_from(WorkspaceMember)
        .where(WorkspaceMember.user_id == owner_id)
    )
    if count.scalar_one() <= 1:
        raise ValueError("last_workspace")
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if ws:
        await db.delete(ws)
        await db.commit()


async def get_workspace_members(db: AsyncSession, workspace_id: str):
    result = await db.execute(
        select(User.id, User.name, User.email, User.avatar, WorkspaceMember.role, WorkspaceMember.joined_at)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    return result.all()


async def is_workspace_member(db: AsyncSession, workspace_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(WorkspaceMember).where(
            and_(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        )
    )
    return result.scalar_one_or_none() is not None


async def get_member_role(db: AsyncSession, workspace_id: str, user_id: str) -> str | None:
    result = await db.execute(
        select(WorkspaceMember.role).where(
            and_(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        )
    )
    row = result.scalar_one_or_none()
    return row


async def add_member(db: AsyncSession, workspace_id: str, user_id: str, role: str = "viewer"):
    existing = await db.execute(
        select(WorkspaceMember).where(
            and_(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        )
    )
    if existing.scalar_one_or_none():
        return
    db.add(WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role))
    await db.commit()


async def remove_member(db: AsyncSession, workspace_id: str, user_id: str):
    result = await db.execute(
        select(WorkspaceMember).where(
            and_(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        )
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()


# ── Toolkits ──


async def list_workspace_toolkits(db: AsyncSession, workspace_id: str):
    """Return all toolkits with an `installed` flag relative to the workspace."""
    result = await db.execute(
        select(
            Toolkit,
            select(WorkspaceToolkit.toolkit_id)
            .where(
                and_(
                    WorkspaceToolkit.workspace_id == workspace_id,
                    WorkspaceToolkit.toolkit_id == Toolkit.id,
                )
            )
            .exists()
            .label("installed"),
        ).order_by(Toolkit.name)
    )
    return result.all()


async def install_toolkit(db: AsyncSession, workspace_id: str, toolkit_id: str, user_id: str):
    existing = await db.execute(
        select(WorkspaceToolkit).where(
            and_(WorkspaceToolkit.workspace_id == workspace_id, WorkspaceToolkit.toolkit_id == toolkit_id)
        )
    )
    if existing.scalar_one_or_none():
        return
    tk = await db.execute(select(Toolkit).where(Toolkit.id == toolkit_id))
    if not tk.scalar_one_or_none():
        raise ValueError("toolkit_not_found")
    db.add(WorkspaceToolkit(workspace_id=workspace_id, toolkit_id=toolkit_id, installed_by=user_id))
    await db.commit()


async def uninstall_toolkit(db: AsyncSession, workspace_id: str, toolkit_id: str):
    result = await db.execute(
        select(WorkspaceToolkit).where(
            and_(WorkspaceToolkit.workspace_id == workspace_id, WorkspaceToolkit.toolkit_id == toolkit_id)
        )
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()


async def list_workspace_mcp_servers(db: AsyncSession, workspace_id: str):
    """Active MCP servers registered for this workspace (same DB as gateway)."""
    from shared.models.mcp_server import McpServer

    result = await db.execute(
        select(McpServer)
        .where(McpServer.workspace_id == workspace_id, McpServer.is_active.is_(True))
        .order_by(McpServer.name),
    )
    return list(result.scalars().all())


async def register_toolkit(db: AsyncSession, data: dict) -> Toolkit:
    """Register a new external (mcp / custom) toolkit into the global registry."""
    data = dict(data)
    workspace_id = data.pop("workspace_id", None)
    source = data.get("source", "custom")

    if source == "mcp":
        mcp_id = data.get("mcp_server_id")
        if not mcp_id or not workspace_id:
            raise ValueError("invalid_mcp_server")
        from shared.models.mcp_server import McpServer

        r = await db.execute(
            select(McpServer).where(
                McpServer.id == mcp_id,
                McpServer.workspace_id == workspace_id,
                McpServer.is_active.is_(True),
            ),
        )
        row = r.scalar_one_or_none()
        if row is None or row.transport != "streamable_http" or not row.url:
            raise ValueError("invalid_mcp_server")
    elif source == "custom":
        data["mcp_server_id"] = None

    tk = Toolkit(**data)
    db.add(tk)
    await db.commit()
    await db.refresh(tk)
    return tk


async def update_toolkit(db: AsyncSession, toolkit_id: str, data: dict) -> Toolkit | None:
    result = await db.execute(select(Toolkit).where(Toolkit.id == toolkit_id))
    tk = result.scalar_one_or_none()
    if not tk:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(tk, key, value)
    await db.commit()
    await db.refresh(tk)
    return tk


async def delete_toolkit(db: AsyncSession, toolkit_id: str):
    result = await db.execute(select(Toolkit).where(Toolkit.id == toolkit_id))
    tk = result.scalar_one_or_none()
    if not tk:
        raise ValueError("toolkit_not_found")
    if tk.is_builtin:
        raise ValueError("cannot_delete_builtin")
    await db.delete(tk)
    await db.commit()


async def resolve_installed_toolkits(db: AsyncSession, workspace_id: str) -> list[dict]:
    """Return fully resolved toolkit info for agent execution.

    For MCP-backed toolkits the mcp_server URL is joined in so the sandbox
    executor can proxy calls without a second query.
    """
    from shared.models.mcp_server import McpServer

    result = await db.execute(
        select(Toolkit, WorkspaceToolkit.config_override, McpServer.url)
        .join(WorkspaceToolkit, and_(
            WorkspaceToolkit.toolkit_id == Toolkit.id,
            WorkspaceToolkit.workspace_id == workspace_id,
        ))
        .outerjoin(McpServer, Toolkit.mcp_server_id == McpServer.id)
        .order_by(Toolkit.name)
    )
    rows = result.all()
    return [
        {
            "id": tk.id,
            "name": tk.name,
            "source": tk.source,
            "executor_key": tk.executor_key,
            "mcp_server_id": tk.mcp_server_id,
            "mcp_server_url": mcp_url,
            "config_json": tk.config_json,
            "config_override": config_override,
        }
        for tk, config_override, mcp_url in rows
    ]
