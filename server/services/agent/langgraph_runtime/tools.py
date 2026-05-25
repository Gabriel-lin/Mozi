"""Production-grade tools registry for the LangGraph agent.

Tools are built with :func:`langchain.tools.tool` and grouped into themed
toolsets so callers can compose what each agent needs. Network access uses
``httpx.AsyncClient`` with explicit timeouts; no implicit blocking I/O.

Tools defined here:

* ``geocode_location`` — Open-Meteo geocoder
* ``weather_forecast`` — Open-Meteo current/forecast
* ``web_search`` — DuckDuckGo Lite HTML search (no API key, best-effort RAG)
* ``fetch_url`` — read text/HTML content from an URL
* ``list_skills`` — enumerate locally available Mozi skills from the filesystem
* ``read_skill`` — read a skill's ``SKILL.md`` body so the LLM can ground answers
"""

from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import urljoin

import httpx
import structlog
from langchain_core.tools import BaseTool, tool
from pydantic import Field

from services.agent import skills_fs

log = structlog.get_logger()

_HTTP_TIMEOUT = httpx.Timeout(connect=8.0, read=20.0, write=20.0, pool=30.0)
_USER_AGENT = "MoziAgent/0.1 (+https://github.com/) langchain-runtime"


# --- weather toolset ---------------------------------------------------------


@tool
async def geocode_location(
    query: Annotated[str, Field(description="Free-form place name, e.g. 'San Francisco'")],
) -> dict[str, Any]:
    """Resolve a place name to coordinates using Open-Meteo's geocoding API.

    Returns a dict with ``name``, ``country``, ``latitude``, ``longitude`` and
    ``timezone`` for the top match, or ``{"error": ...}`` when no result.
    """
    async with httpx.AsyncClient(
        timeout=_HTTP_TIMEOUT, headers={"User-Agent": _USER_AGENT}
    ) as client:
        resp = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": query, "count": 1, "language": "en", "format": "json"},
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results") or []
        if not results:
            return {"error": f"No geocoding result for {query!r}"}
        top = results[0]
        return {
            "name": top.get("name"),
            "country": top.get("country"),
            "latitude": top.get("latitude"),
            "longitude": top.get("longitude"),
            "timezone": top.get("timezone"),
        }


@tool
async def weather_forecast(
    latitude: Annotated[float, Field(description="Latitude in decimal degrees")],
    longitude: Annotated[float, Field(description="Longitude in decimal degrees")],
) -> dict[str, Any]:
    """Fetch current weather and 3-day daily forecast from Open-Meteo.

    Call :func:`geocode_location` first to obtain coordinates for free-form
    locations.
    """
    async with httpx.AsyncClient(
        timeout=_HTTP_TIMEOUT, headers={"User-Agent": _USER_AGENT}
    ) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
                "forecast_days": 3,
                "timezone": "auto",
            },
        )
        resp.raise_for_status()
        return resp.json()


# --- retrieval toolset -------------------------------------------------------


_DDG_RESULT_RE = re.compile(
    r'<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
    r'<a[^>]*class="result-snippet"[^>]*>(.*?)</a>',
    re.DOTALL,
)


def _strip_html(s: str) -> str:
    no_tags = re.sub(r"<[^>]+>", "", s)
    return html.unescape(no_tags).strip()


@tool
async def web_search(
    query: Annotated[str, Field(description="Search query")],
    max_results: Annotated[int, Field(description="Max results to return, 1-10", ge=1, le=10)] = 5,
) -> list[dict[str, str]]:
    """Search the web with DuckDuckGo Lite and return ``[{title,url,snippet}]``.

    Best-effort retrieval for RAG-style grounding when the agent needs fresh,
    citable references. No API key required.
    """
    async with httpx.AsyncClient(
        timeout=_HTTP_TIMEOUT,
        headers={"User-Agent": _USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        follow_redirects=True,
    ) as client:
        resp = await client.post("https://html.duckduckgo.com/html/", data={"q": query})
        if resp.status_code != 200:
            log.warning("web_search_http_error", status=resp.status_code)
            return []
    out: list[dict[str, str]] = []
    for m in _DDG_RESULT_RE.finditer(resp.text):
        raw_url, raw_title, raw_snippet = m.group(1), m.group(2), m.group(3)
        # DDG wraps real URL in `?uddg=` redirect — extract it when present.
        real_url = raw_url
        if "uddg=" in real_url:
            try:
                from urllib.parse import parse_qs, urlparse

                qs = parse_qs(urlparse(urljoin("https://html.duckduckgo.com/", real_url)).query)
                real_url = qs.get("uddg", [real_url])[0]
            except Exception:
                pass
        out.append(
            {
                "title": _strip_html(raw_title),
                "url": real_url,
                "snippet": _strip_html(raw_snippet),
            }
        )
        if len(out) >= max_results:
            break
    return out


@tool
async def fetch_url(
    url: Annotated[str, Field(description="Absolute URL to fetch")],
    max_chars: Annotated[
        int, Field(description="Truncate content to this many characters", ge=200, le=80_000)
    ] = 8_000,
) -> dict[str, Any]:
    """Fetch a URL and return ``{"status", "content_type", "text"}``.

    HTML responses are stripped of tags for readability. Binary types return
    an empty ``text`` with a descriptive error.
    """
    async with httpx.AsyncClient(
        timeout=_HTTP_TIMEOUT,
        headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/json;q=0.9,*/*;q=0.5"},
        follow_redirects=True,
    ) as client:
        try:
            resp = await client.get(url)
        except httpx.HTTPError as exc:
            return {"status": 0, "content_type": "", "text": "", "error": str(exc)}
    ctype = resp.headers.get("content-type", "")
    if any(prefix in ctype for prefix in ("text/", "application/json", "application/xml")):
        body = resp.text
        if "html" in ctype:
            body = _strip_html(body)
        return {
            "status": resp.status_code,
            "content_type": ctype,
            "text": body[:max_chars],
        }
    return {
        "status": resp.status_code,
        "content_type": ctype,
        "text": "",
        "error": f"Unsupported content-type for direct read: {ctype}",
    }


# --- skills toolset ----------------------------------------------------------


def _skill_search_bases() -> list[Path]:
    return [skills_fs.skills_dir_mozi(), skills_fs.skills_dir_agents()]


@tool
def list_skills() -> list[dict[str, str]]:
    """List Mozi skills available on this machine.

    Skills are folders containing a ``SKILL.md`` file under
    ``~/.Mozi/skills`` or ``~/.agents/skills``. Use :func:`read_skill` to load
    a specific skill's instructions before acting on its domain.
    """
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for base in _skill_search_bases():
        if not base.is_dir():
            continue
        for skill_id in sorted(skills_fs.discover_skill_ids(base)):
            if skill_id in seen:
                continue
            seen.add(skill_id)
            skill_md = base / skill_id / "SKILL.md"
            title = skill_id
            description = ""
            if skill_md.is_file():
                try:
                    head = skill_md.read_text(encoding="utf-8", errors="replace")[:2_000]
                    m = re.search(r"^description:\s*(.+)$", head, re.MULTILINE | re.IGNORECASE)
                    if m:
                        description = m.group(1).strip().strip("\"'")
                    m2 = re.search(r"^#\s+(.+)$", head, re.MULTILINE)
                    if m2:
                        title = m2.group(1).strip()
                except OSError:
                    pass
            out.append({"id": skill_id, "title": title, "description": description})
    return out


@tool
def read_skill(
    skill_id: Annotated[str, Field(description="Skill folder name, e.g. 'web-design'")],
    max_chars: Annotated[
        int, Field(description="Max characters to return", ge=500, le=120_000)
    ] = 30_000,
) -> dict[str, str]:
    """Read ``SKILL.md`` for a given skill and return its body text."""
    if not skills_fs._loose_path_skill_id(skill_id):  # type: ignore[attr-defined]
        return {"error": "invalid_skill_id", "id": skill_id, "body": ""}
    for base in _skill_search_bases():
        path = base / skill_id / "SKILL.md"
        if path.is_file():
            try:
                body = path.read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                return {"error": str(exc), "id": skill_id, "body": ""}
            return {"id": skill_id, "path": str(path), "body": body[:max_chars]}
    return {"error": "not_found", "id": skill_id, "body": ""}


# --- assembly ----------------------------------------------------------------


WEATHER_TOOLS: list[BaseTool] = [geocode_location, weather_forecast]
RETRIEVAL_TOOLS: list[BaseTool] = [web_search, fetch_url]
SKILL_TOOLS: list[BaseTool] = [list_skills, read_skill]

DEFAULT_TOOLS: list[BaseTool] = [*WEATHER_TOOLS, *RETRIEVAL_TOOLS, *SKILL_TOOLS]


def build_tools_for_agent(config: dict[str, Any] | None) -> list[BaseTool]:
    """Pick the tool subset for an Agent record's ``config``.

    The ``config`` dict may include::

        {
          "tools": ["weather", "retrieval", "skills"]  # subsets, optional
        }

    If absent, all tools are returned. Unknown subset names are ignored.
    """
    cfg = config or {}
    raw = cfg.get("tools")
    if not isinstance(raw, list) or not raw:
        return list(DEFAULT_TOOLS)
    groups = {
        "weather": WEATHER_TOOLS,
        "retrieval": RETRIEVAL_TOOLS,
        "search": RETRIEVAL_TOOLS,
        "skills": SKILL_TOOLS,
    }
    selected: list[BaseTool] = []
    seen: set[str] = set()
    for key in raw:
        bucket = groups.get(str(key).lower())
        if not bucket:
            continue
        for t in bucket:
            if t.name in seen:
                continue
            selected.append(t)
            seen.add(t.name)
    return selected or list(DEFAULT_TOOLS)
