from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9-]+$")
    description: str | None = Field(None, max_length=500)
    type: str = "local"
    path: str | None = Field(None, max_length=500)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    type: str
    path: str | None = None
    owner_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceListOut(BaseModel):
    workspaces: list[WorkspaceOut]


class MemberOut(BaseModel):
    user_id: str
    name: str
    email: str
    avatar: str | None = None
    role: str
    joined_at: datetime


class MemberListOut(BaseModel):
    members: list[MemberOut]


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "viewer"
