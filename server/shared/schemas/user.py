from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar: str | None = None
    github_login: str | None = None
    phone: str | None = None
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    avatar: str | None = None


class UserListOut(BaseModel):
    users: list[UserOut]
    total: int
    page: int
    page_size: int


class RoleOut(BaseModel):
    id: str
    name: str
    permissions: list[str]
    assigned_at: datetime | None = None

    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    role_id: str
