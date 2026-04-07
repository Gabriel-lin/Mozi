from datetime import datetime

from pydantic import BaseModel, Field


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    workspace_id: str
    tags: list[str] | None = Field(None, max_length=20)


class WorkflowUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    status: str | None = Field(None, pattern=r"^(draft|active|archived)$")
    tags: list[str] | None = None


class WorkflowOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    status: str
    workspace_id: str
    created_by: str
    tags: list
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowListOut(BaseModel):
    workflows: list[WorkflowOut]
    total: int
    page: int
    page_size: int


class VersionCreate(BaseModel):
    graph_data: dict
    change_log: str | None = Field(None, max_length=500)


class VersionOut(BaseModel):
    id: str
    workflow_id: str
    version: int
    graph_data: dict
    change_log: str | None = None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionListOut(BaseModel):
    versions: list[VersionOut]
    total: int
    page: int
    page_size: int


class RunCreate(BaseModel):
    input_data: dict | None = None
    version_id: str | None = None


class RunOut(BaseModel):
    id: str
    workflow_id: str
    version_id: str | None = None
    status: str
    input_data: dict | None = None
    output_data: dict | None = None
    context_data: dict | None = None
    node_results: list
    error: str | None = None
    triggered_by: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RunListOut(BaseModel):
    runs: list[RunOut]
    total: int
    page: int
    page_size: int


# ── WebSocket events ──


class RunEvent(BaseModel):
    """Single event pushed through the WebSocket during workflow execution."""
    type: str
    node_id: str | None = None
    output: dict | None = None
    error: str | None = None
    duration_ms: int | None = None
    node_results: list | None = None
    timestamp: int | None = None


class WorkflowValidationError(BaseModel):
    """Returned when workflow validation fails (HTTP 422)."""
    detail: str = "工作流验证失败"
    errors: list[str]
