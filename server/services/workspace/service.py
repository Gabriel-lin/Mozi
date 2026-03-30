from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.user import User
from shared.models.role import Role, UserRole
from shared.models.workspace import Workspace, WorkspaceMember


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
