from __future__ import annotations

import asyncio
import json
from enum import Enum

from pydantic import BaseModel, Field

from ._base import BuiltinTool, register


class SupportedLanguage(str, Enum):
    python = "python"
    javascript = "javascript"
    bash = "bash"


class CodeExecutorInput(BaseModel):
    code: str = Field(description="Source code to execute")
    language: SupportedLanguage = Field(
        default=SupportedLanguage.python,
        description="Programming language (python / javascript / bash)",
    )
    timeout: int = Field(default=30, ge=1, le=120, description="Execution timeout in seconds")


_LANG_CMD: dict[str, list[str]] = {
    "python": ["python3", "-c"],
    "javascript": ["node", "-e"],
    "bash": ["bash", "-c"],
}


@register("code_executor")
class CodeExecutorTool(BuiltinTool):
    name = "code_executor"
    description = (
        "Execute a code snippet in a sandboxed subprocess. "
        "Supports Python, JavaScript and Bash. Returns stdout/stderr."
    )
    args_schema = CodeExecutorInput

    async def execute(
        self, code: str, language: str = "python", timeout: int = 30,
    ) -> str:
        max_timeout = self.config.get("max_timeout", 60)
        timeout = min(timeout, max_timeout)
        lang = language if language in _LANG_CMD else "python"
        cmd = _LANG_CMD[lang]

        proc = await asyncio.create_subprocess_exec(
            *cmd, code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return json.dumps({
                "exit_code": -1, "error": f"Execution timed out after {timeout}s",
            })

        return json.dumps({
            "exit_code": proc.returncode,
            "stdout": stdout.decode(errors="replace")[:8000],
            "stderr": stderr.decode(errors="replace")[:4000],
        })
