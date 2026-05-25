from pydantic import BaseModel


class WorkspaceMcpServerOut(BaseModel):
    id: str
    name: str
    url: str | None = None
    transport: str = "streamable_http"
    workspace_id: str


class WorkspaceMcpServerListOut(BaseModel):
    servers: list[WorkspaceMcpServerOut]
