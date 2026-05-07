from __future__ import annotations

import re
import shutil
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path
from typing import BinaryIO, Literal

from shared.config import get_settings

_SKILL_ID = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

SourceT = Literal["mozi", "agents", "config"]

# Ignore vendor / tooling trees when scanning for SKILL.md
_IGNORE_DIR_PARTS = frozenset(
    {"node_modules", ".git", "__pycache__", ".cache", "dist", "build", ".next", "vendor"}
)


def resolve_user_home() -> Path:
    settings = get_settings()
    if settings.user_home:
        return Path(settings.user_home).expanduser().resolve()
    return Path.home().resolve()


def skills_dir_mozi() -> Path:
    return resolve_user_home() / ".Mozi" / "skills"


def skills_dir_agents() -> Path:
    return resolve_user_home() / ".agents" / "skills"


def _loose_path_skill_id(s: str) -> bool:
    """Skill id: optional nested path, no .., no empty segment, no hidden path components."""
    t = s.strip().replace("\\", "/").strip("/")
    if not t or ".." in t.split("/"):
        return False
    for part in t.split("/"):
        if not part or part in (".", ".."):
            return False
        if part.startswith("."):
            return False
    return True


def _path_under_base(path: Path, base: Path) -> bool:
    try:
        path.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _rglob_path_ignored(path: Path, base: Path) -> bool:
    if not _path_under_base(path, base):
        return True
    try:
        rel = path.relative_to(base)
    except ValueError:
        return True
    for p in rel.parts:
        if p in _IGNORE_DIR_PARTS or (p.startswith(".") and p not in (".", "..")):
            return True
    return False


def discover_skill_ids(base: Path) -> set[str]:
    """
    All skill directory ids under base: any directory (possibly nested) that directly contains SKILL.md.
    Supports layouts like ./foo/SKILL.md and ./scope/pkg/SKILL.md (id "scope/pkg").
    """
    if not base.is_dir():
        return set()
    out: set[str] = set()
    for skill_md in base.rglob("SKILL.md"):
        if _rglob_path_ignored(skill_md, base):
            continue
        try:
            rel = skill_md.parent.relative_to(base)
        except ValueError:
            continue
        if rel == Path(".") or str(rel) in (".", ""):
            continue
        rid = rel.as_posix()
        if not _loose_path_skill_id(rid):
            continue
        out.add(rid)
    return out


def _valid_id(name: str) -> bool:
    return bool(_SKILL_ID.match(name)) and ".." not in name


def skill_dir(base: Path, skill_id: str) -> Path:
    """Directory that contains this skill's SKILL.md (skill_id may be "a" or "a/b/c")."""
    parts = [p for p in skill_id.replace("\\", "/").strip("/").split("/") if p and p not in (".", "..")]
    d = base
    for p in parts:
        d = d / p
    return d


def read_skill_title(base: Path, skill_id: str) -> str | None:
    md = skill_dir(base, skill_id) / "SKILL.md"
    if not md.is_file():
        return None
    try:
        text = md.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip() or None
    return None


def label_for(skill_id: str, mozi: Path, agents: Path) -> str:
    for base in (mozi, agents):
        t = read_skill_title(base, skill_id)
        if t:
            return t
    return skill_id


def _normalize_config_skills(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if str(x).strip() and _loose_path_skill_id(str(x).strip())]


def build_catalog(
    config_skills_raw: object,
) -> tuple[list[dict], list[str]]:
    """Return (items for AgentSkillCatalogOut, selected ids from config)."""
    if isinstance(config_skills_raw, list):
        cfg_ids = _normalize_config_skills(config_skills_raw)
    else:
        cfg_ids = []
    mozi = skills_dir_mozi()
    agents = skills_dir_agents()

    on_disk_mozi = discover_skill_ids(mozi)
    on_disk_agents = discover_skill_ids(agents)

    ids: set[str] = set(on_disk_mozi) | set(on_disk_agents)
    for sid in cfg_ids:
        ids.add(sid)

    items: list[dict] = []
    selected = list(cfg_ids)

    for skill_id in sorted(ids):
        sources: list[SourceT] = []
        if skill_id in on_disk_mozi:
            sources.append("mozi")
        if skill_id in on_disk_agents:
            sources.append("agents")
        if not sources:
            sources.append("config")

        label = label_for(skill_id, mozi, agents)
        items.append(
            {
                "id": skill_id,
                "label": label,
                "sources": sources,
            }
        )
    return items, selected


def _normalize_new_skill_id(raw: str) -> str:
    s = raw.strip().lower()
    s = s.replace("_", "-")
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9-]+", "", s)
    s = re.sub(r"-+", "-", s).strip("-")
    if not s or not _valid_id(s):
        raise ValueError("invalid skill id")
    return s


def create_local_mozi_skill(skill_id: str, title: str | None, description: str | None) -> Path:
    skill_id = _normalize_new_skill_id(skill_id)
    base = skills_dir_mozi() / skill_id
    if base.exists():
        raise FileExistsError(skill_id)
    base.mkdir(parents=True, exist_ok=True)
    head = title.strip() if title and title.strip() else skill_id
    desc = (description or "").strip()
    body = [
        f"# {head}",
        "",
        f"{desc}" if desc else "Describe what this skill does, when to use it, and key constraints.",
        "",
    ]
    (base / "SKILL.md").write_text("\n".join(body), encoding="utf-8")
    return base


def relpaths_from_webkit_names(filenames: list[str | None]) -> list[str]:
    """Strip a single top-level directory when all paths share (browser folder selection)."""
    names = [str(n or "").replace("\\", "/").strip() for n in filenames]
    names = [n for n in names if n]
    if not names:
        return []
    segs = [n.split("/") for n in names]
    if len(segs[0]) >= 2 and all(len(s) >= 2 and s[0] == segs[0][0] for s in segs):
        return ["/".join(s[1:]) for s in segs]
    return names


def _assert_safe_relpath(rel: str) -> str:
    rel = rel.replace("\\", "/").strip()
    for part in rel.split("/"):
        if not part or part in (".", "..") or ".." in part:
            raise ValueError("invalid relative path in skill tree")
    return rel


def import_mozi_file_pairs(skill_id: str, pairs: list[tuple[str, bytes]]) -> Path:
    if not pairs:
        raise ValueError("no file bytes")
    skill_id = _normalize_new_skill_id(skill_id)
    base = skills_dir_mozi() / skill_id
    if base.exists() and any(base.iterdir()):
        raise FileExistsError(skill_id)
    if not base.exists():
        base.mkdir(parents=True, exist_ok=True)
    try:
        for rel, data in pairs:
            rel = _assert_safe_relpath(rel)
            p = (base / rel).resolve()
            base_r = (skills_dir_mozi() / skill_id).resolve()
            p.relative_to(base_r)  # traversal guard
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
    except (ValueError, OSError) as e:
        if base.is_dir() and (skills_dir_mozi() / skill_id).exists():
            shutil.rmtree(skills_dir_mozi() / skill_id, ignore_errors=True)
        raise e
    if not (base / "SKILL.md").is_file():
        shutil.rmtree(base, ignore_errors=True)
        raise ValueError("SKILL.md is required at the root of the imported skill")
    return base


def _find_dir_with_skill_md(extracted: Path) -> Path:
    for md in extracted.rglob("SKILL.md"):
        return md.parent
    raise ValueError("no SKILL.md found in the archive or folder tree")


def import_mozi_zip_file(skill_id: str, buf: bytes | BinaryIO) -> Path:
    skill_id = _normalize_new_skill_id(skill_id)
    target = skills_dir_mozi() / skill_id
    if target.exists() and any(target.iterdir()):
        raise FileExistsError(skill_id)
    b = buf if isinstance(buf, bytes) else buf.read()
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        with zipfile.ZipFile(BytesIO(b)) as zf:
            for name in zf.namelist():
                n = name.replace("\\", "/")
                if n.startswith(("/", "../")) or "/../" in n or n.startswith(".."):
                    raise ValueError("unsafe path in zip")
            zf.extractall(t)
        src = _find_dir_with_skill_md(t)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise FileExistsError(skill_id)
    shutil.copytree(src, target)
    return target
