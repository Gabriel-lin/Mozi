from typing import Literal

from pydantic import BaseModel, Field


class SkillSourceOut(BaseModel):
    id: str
    label: str
    sources: list[Literal["mozi", "agents", "config"]] = Field(default_factory=list)


class AgentSkillCatalogOut(BaseModel):
    items: list[SkillSourceOut]
    selected: list[str]


class CreateLocalSkillIn(BaseModel):
    """`name` is normalized to a kebab-case id under ~/.Mozi/skills/<id>/."""

    name: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=2000)
