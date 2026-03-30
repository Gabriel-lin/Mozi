from pydantic import BaseModel, EmailStr


class GitHubCallbackRequest(BaseModel):
    code: str


class DeviceTokenRequest(BaseModel):
    access_token: str


class GitHubLinkRequest(BaseModel):
    access_token: str


class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str


class EmailRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class AuthResponse(BaseModel):
    token: str
    refresh_token: str | None = None
    expires_at: str
    user: "UserBrief"


class UserBrief(BaseModel):
    id: str
    email: str
    name: str
    avatar: str | None = None
    github_id: int | None = None
    github_login: str | None = None
