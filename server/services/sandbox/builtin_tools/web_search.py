from __future__ import annotations

import json

import httpx
from pydantic import BaseModel, Field

from ._base import BuiltinTool, extract_between, register, strip_tags


class WebSearchInput(BaseModel):
    query: str = Field(description="Search query string")
    max_results: int = Field(default=5, ge=1, le=20, description="Maximum number of results")


@register("web_search")
class WebSearchTool(BuiltinTool):
    name = "web_search"
    description = (
        "Search the web for real-time information. "
        "Returns a list of search results with titles, URLs and snippets."
    )
    args_schema = WebSearchInput

    async def execute(self, query: str, max_results: int = 5) -> str:
        endpoint = self.config.get("endpoint", "https://html.duckduckgo.com/html/")
        timeout = self.config.get("timeout", 30)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.post(endpoint, data={"q": query})
            resp.raise_for_status()

        body = resp.text
        results: list[dict] = []
        for block in body.split('class="result__body"')[1: max_results + 1]:
            title = extract_between(block, 'class="result__a"', "</a>")
            snippet = extract_between(block, 'class="result__snippet"', "</td>")
            url = extract_between(block, 'href="', '"')
            if title:
                results.append({
                    "title": strip_tags(title),
                    "snippet": strip_tags(snippet),
                    "url": url,
                })

        if not results:
            return json.dumps({"query": query, "results": [], "note": "No results found."})
        return json.dumps({"query": query, "results": results}, ensure_ascii=False)
