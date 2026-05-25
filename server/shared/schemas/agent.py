from datetime import datetime
from typing import Literal

from typing import Any

from pydantic import BaseModel, Field, field_validator

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


class RunAttachmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = Field(None, max_length=120)
    text: str | None = Field(None, max_length=120_000)


class RunCreate(BaseModel):
    goal: str = Field(min_length=1, max_length=8000)
    attachments: list[RunAttachmentIn] | None = Field(None, max_length=12)
    model: str | None = Field(
        None,
        max_length=100,
        description="If set, overrides Agent.model for this run only (OpenAI model id or vLLM served name).",
    )
    replace_run_id: str | None = Field(
        None,
        max_length=21,
        description="If set, reset this existing run and re-queue it instead of creating a new row.",
    )
    continue_run_id: str | None = Field(
        None,
        max_length=21,
        description="If set, re-queue this run with a new user turn (multi-turn in one run row).",
    )


class RunConversationPatch(BaseModel):
    """Persisted UI thread: legacy flat list, or v2 object with `linear` (worker) + `tree` (branches)."""

    conversation: list[dict] | dict

    @field_validator("conversation")
    @classmethod
    def _conversation_size(cls, v):
        if isinstance(v, list):
            if len(v) > 500:
                raise ValueError("conversation list too long")
            return v
        if isinstance(v, dict):
            lin = v.get("linear")
            if isinstance(lin, list) and len(lin) > 400:
                raise ValueError("conversation.linear too long")
            tree = v.get("tree")
            if isinstance(tree, dict):
                msgs = tree.get("messages")
                if isinstance(msgs, list) and len(msgs) > 600:
                    raise ValueError("conversation.tree.messages too large")
        return v


class RunPinBody(BaseModel):
    pinned: bool


class RunFeedbackBody(BaseModel):
    feedback: Literal["positive", "negative"] | None = None


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
    pinned_at: datetime | None = None
    feedback: str | None = None
    conversation: Any | None = None

    model_config = {"from_attributes": True}


class RunListOut(BaseModel):
    runs: list[RunOut]
    total: int
    page: int
    page_size: int
