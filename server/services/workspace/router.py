from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from shared.schemas.user import AssignRoleRequest, RoleOut, UserListOut, UserOut, UserUpdate
from shared.schemas.workspace import (
    AddMemberRequest, MemberListOut, MemberOut, WorkspaceCreate,
    WorkspaceListOut, WorkspaceOut, WorkspaceUpdate,
)
from . import service

router = APIRouter(tags=["workspace"])
user_router = APIRouter(prefix="/users", tags=["users"])
ws_router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ── Users ──

@user_router.get("/", response_model=UserListOut)
async def list_users(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    users, total, p, ps = await service.list_users(db, page, page_size, search)
    return UserListOut(users=[UserOut.model_validate(u) for u in users], total=total, page=p, page_size=ps)


@user_router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@user_router.patch("/me", response_model=UserOut)
async def update_me(body: UserUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    updated = await service.update_user(db, user.id, body.model_dump(exclude_unset=True))
    return UserOut.model_validate(updated)


@user_router.get("/{user_id}/roles")
async def get_roles(user_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user_id != user.id:
        raise HTTPException(403, "Forbidden")
    rows = await service.get_user_roles(db, user_id)
    return {"roles": [{"id": r.id, "name": r.name, "permissions": r.permissions, "assigned_at": a.isoformat() if a else None} for r, a in rows]}


@user_router.post("/{user_id}/roles")
async def assign_role(user_id: str, body: AssignRoleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await service.assign_role(db, user_id, body.role_id)
    return {"success": True}


@user_router.delete("/{user_id}/roles/{role_id}")
async def remove_role(user_id: str, role_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await service.remove_role(db, user_id, role_id)
    return {"success": True}


# ── Workspaces ──

@ws_router.get("/")
async def list_workspaces(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await service.get_user_workspaces(db, user.id)
    return {
        "workspaces": [WorkspaceOut.model_validate(ws) for ws, role, joined in rows],
        "active_workspace_id": user.active_workspace_id,
    }


@ws_router.post("/", response_model=WorkspaceOut, status_code=201)
async def create_workspace(body: WorkspaceCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ws = await service.create_workspace(db, user.id, body.model_dump())
    return WorkspaceOut.model_validate(ws)


@ws_router.post("/{ws_id}/activate")
async def activate_workspace(ws_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await service.is_workspace_member(db, ws_id, user.id):
        raise HTTPException(403, "Forbidden")
    await service.set_active_workspace(db, user, ws_id)
    return {"success": True, "active_workspace_id": ws_id}


@ws_router.get("/{ws_id}", response_model=WorkspaceOut)
async def get_workspace(ws_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await service.is_workspace_member(db, ws_id, user.id):
        raise HTTPException(403, "Forbidden")
    ws = await service.get_workspace_by_id(db, ws_id)
    if not ws:
        raise HTTPException(404, "Not found")
    return WorkspaceOut.model_validate(ws)


@ws_router.patch("/{ws_id}", response_model=WorkspaceOut)
async def update_workspace(ws_id: str, body: WorkspaceUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await service.get_member_role(db, ws_id, user.id)
    if role not in ("owner", "admin"):
        raise HTTPException(403, "Requires owner or admin")
    ws = await service.update_workspace(db, ws_id, body.model_dump(exclude_unset=True))
    return WorkspaceOut.model_validate(ws)


@ws_router.delete("/{ws_id}")
async def delete_workspace(ws_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await service.get_member_role(db, ws_id, user.id)
    if role != "owner":
        raise HTTPException(403, "Only owner can delete")
    try:
        await service.delete_workspace(db, ws_id, user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"success": True}


@ws_router.get("/{ws_id}/members", response_model=MemberListOut)
async def list_members(ws_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await service.is_workspace_member(db, ws_id, user.id):
        raise HTTPException(403, "Forbidden")
    rows = await service.get_workspace_members(db, ws_id)
    return MemberListOut(members=[MemberOut(user_id=r[0], name=r[1], email=r[2], avatar=r[3], role=r[4], joined_at=r[5]) for r in rows])


@ws_router.post("/{ws_id}/members", status_code=201)
async def add_member(ws_id: str, body: AddMemberRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await service.get_member_role(db, ws_id, user.id)
    if role not in ("owner", "admin"):
        raise HTTPException(403, "Forbidden")
    await service.add_member(db, ws_id, body.user_id, body.role)
    return {"success": True}


@ws_router.delete("/{ws_id}/members/{target_id}")
async def remove_member(ws_id: str, target_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await service.get_member_role(db, ws_id, user.id)
    if role not in ("owner", "admin"):
        raise HTTPException(403, "Forbidden")
    await service.remove_member(db, ws_id, target_id)
    return {"success": True}


router.include_router(user_router)
router.include_router(ws_router)
