from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ToolkitOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    version: str
    installed: bool
    category: str | None = None
    icon: str | None = None
    source: Literal["builtin", "mcp", "custom"] = "builtin"
    executor_key: str | None = None
    mcp_server_id: str | None = None

    model_config = {"from_attributes": True}


class ToolkitListOut(BaseModel):
    toolkits: list[ToolkitOut]
    total: int


class ToolkitRegister(BaseModel):
    """Register a new external (mcp / custom) toolkit."""
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    version: str = Field(default="0.1.0", max_length=30)
    category: str | None = Field(None, max_length=50)
    icon: str | None = Field(None, max_length=100)
    source: Literal["mcp", "custom"] = "custom"
    mcp_server_id: str | None = None
    workspace_id: str | None = Field(
        default=None,
        max_length=21,
        description="Current workspace; required when source=mcp to validate MCP server ownership",
    )
    executor_key: str | None = None
    config_json: str = "{}"

    @model_validator(mode="after")
    def validate_mcp_workspace(self):
        if self.source == "mcp":
            if not self.mcp_server_id:
                raise ValueError("mcp_server_id is required for source=mcp")
            if not self.workspace_id:
                raise ValueError("workspace_id is required when source=mcp")
        return self


class ToolkitUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    version: str | None = Field(None, max_length=30)
    category: str | None = Field(None, max_length=50)
    icon: str | None = Field(None, max_length=100)
    config_json: str | None = None


class InstalledToolkitOut(BaseModel):
    """Resolved toolkit info for agent consumption."""
    id: str
    name: str
    source: str
    executor_key: str | None = None
    mcp_server_id: str | None = None
    mcp_server_url: str | None = None
    config_json: str = "{}"
    config_override: str = "{}"

    model_config = {"from_attributes": True}


class ResolvedToolkitsOut(BaseModel):
    toolkits: list[InstalledToolkitOut]
