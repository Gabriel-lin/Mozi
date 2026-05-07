from __future__ import annotations

import json
from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field

from ._base import BuiltinTool, register


class FileAction(str, Enum):
    read = "read"
    write = "write"
    append = "append"
    list_dir = "list_dir"
    delete = "delete"


class FileManagerInput(BaseModel):
    action: FileAction = Field(description="File operation to perform")
    path: str = Field(description="Relative file path inside the workspace")
    content: str = Field(default="", description="Content to write (for write/append)")


@register("file_manager")
class FileManagerTool(BuiltinTool):
    name = "file_manager"
    description = (
        "Read, write, append, list or delete files within the workspace directory. "
        "Paths are relative to the workspace root."
    )
    args_schema = FileManagerInput

    def _resolve(self, rel: str) -> Path:
        root = Path(self.config.get("workspace_root", "/tmp/mozi-workspace"))
        target = (root / rel).resolve()
        if not str(target).startswith(str(root.resolve())):
            raise ValueError("Path traversal detected")
        return target

    async def execute(self, action: str, path: str, content: str = "") -> str:
        target = self._resolve(path)

        match action:
            case "read":
                if not target.exists():
                    return json.dumps({"error": f"File not found: {path}"})
                text = target.read_text(encoding="utf-8", errors="replace")
                return json.dumps({
                    "path": path, "content": text[:20000],
                    "size": target.stat().st_size,
                })

            case "write":
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
                return json.dumps({"path": path, "bytes_written": len(content.encode())})

            case "append":
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("a", encoding="utf-8") as f:
                    f.write(content)
                return json.dumps({"path": path, "bytes_appended": len(content.encode())})

            case "list_dir":
                if not target.exists():
                    return json.dumps({"error": f"Directory not found: {path}"})
                entries = [
                    {
                        "name": p.name,
                        "type": "dir" if p.is_dir() else "file",
                        "size": p.stat().st_size if p.is_file() else 0,
                    }
                    for p in sorted(target.iterdir())
                ][:200]
                return json.dumps({"path": path, "entries": entries})

            case "delete":
                if target.exists():
                    target.unlink()
                    return json.dumps({"path": path, "deleted": True})
                return json.dumps({"path": path, "deleted": False, "error": "Not found"})

            case _:
                return json.dumps({"error": f"Unknown action: {action}"})
