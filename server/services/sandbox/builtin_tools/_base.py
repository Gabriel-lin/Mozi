"""Registry core + BuiltinTool base class.

Usage in a tool module:

    from ._base import BuiltinTool, register

    @register("my_key")
    class MyTool(BuiltinTool): ...
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import ClassVar

import structlog
from langchain_core.tools import StructuredTool

log = structlog.get_logger()

# ── Registry ────────────────────────────────────────────────────────────────

_REGISTRY: dict[str, type[BuiltinTool]] = {}


def register(key: str):
    """Class decorator — register a BuiltinTool subclass under *key*."""
    def _decorator(cls: type[BuiltinTool]):
        if key in _REGISTRY:
            raise ValueError(f"Duplicate builtin tool key: {key}")
        cls.executor_key = key
        _REGISTRY[key] = cls
        return cls
    return _decorator


def get_registry() -> dict[str, type[BuiltinTool]]:
    return dict(_REGISTRY)


# ── Base class ──────────────────────────────────────────────────────────────

class BuiltinTool(ABC):
    """Abstract base for every built-in tool."""

    executor_key: ClassVar[str]
    name: ClassVar[str]
    description: ClassVar[str]

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Run the tool and return a JSON string result."""

    def to_langchain_tool(self) -> StructuredTool:
        schema = getattr(self, "args_schema", None)
        return StructuredTool.from_function(
            coroutine=self.execute,
            name=self.name,
            description=self.description,
            args_schema=schema,
        )


# ── Helpers shared across tool implementations ─────────────────────────────

def merge_config(config_json: str, config_override: str) -> dict:
    base = json.loads(config_json) if config_json else {}
    override = json.loads(config_override) if config_override else {}
    base.update(override)
    return base


def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html).strip()


def extract_between(text: str, start: str, end: str) -> str:
    try:
        i = text.index(start) + len(start)
        j = text.index(end, i)
        return text[i:j]
    except ValueError:
        return ""


# ── Resolver ────────────────────────────────────────────────────────────────

def resolve_builtin_tools(installed: list[dict]) -> list[StructuredTool]:
    """Instantiate LangChain tools for every installed builtin toolkit."""
    tools: list[StructuredTool] = []
    for tk in installed:
        if tk["source"] != "builtin":
            continue
        key = tk.get("executor_key")
        cls = _REGISTRY.get(key) if key else None
        if cls:
            config = merge_config(
                tk.get("config_json", "{}"),
                tk.get("config_override", "{}"),
            )
            try:
                tools.append(cls(config).to_langchain_tool())
            except Exception:
                log.warning("builtin_tool_init_failed", executor_key=key, exc_info=True)
        else:
            log.warning("unknown_executor_key", executor_key=key, toolkit_id=tk["id"])
    return tools
