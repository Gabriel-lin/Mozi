from datetime import datetime

from pydantic import BaseModel, Field

from shared.schemas.skills import AgentSkillCatalogOut


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    config: dict | None = None
    system_prompt: str | None = Field(None, max_length=10000)
    model: str | None = Field(None, max_length=100)
    max_steps: int = Field(10, gt=0, le=100)
    tags: list[str] | None = Field(None, max_length=20)
    workspace_id: str


class AgentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    config: dict | None = None
    system_prompt: str | None = Field(None, max_length=10000)
    model: str | None = Field(None, max_length=100)
    max_steps: int | None = Field(None, gt=0, le=100)
    tags: list[str] | None = None


class AgentOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    version: str
    config: dict
    system_prompt: str | None = None
    model: str | None = None
    max_steps: int
    tags: list
    workspace_id: str
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentDetailOut(AgentOut):
    """`GET /agents/{id}` only — includes discoverable skills for the editor UI."""

    skill_catalog: AgentSkillCatalogOut


class AgentListOut(BaseModel):
    agents: list[AgentOut]
    total: int
    page: int
    page_size: int


class RunCreate(BaseModel):
    goal: str = Field(min_length=1, max_length=5000)


class RunOut(BaseModel):
    id: str
    agent_id: str
    status: str
    goal: str | None = None
    steps: list
    output: dict | None = None
    error: str | None = None
    total_steps: int
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
