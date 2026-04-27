from __future__ import annotations

import json
from enum import Enum

import httpx
from pydantic import BaseModel, Field

from ._base import BuiltinTool, register


class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


class ApiCallerInput(BaseModel):
    method: HttpMethod = Field(description="HTTP method")
    url: str = Field(description="Full URL to request")
    headers: str = Field(default="{}", description="JSON string of request headers")
    body: str = Field(default="", description="Request body (string or JSON)")


@register("api_caller")
class ApiCallerTool(BuiltinTool):
    name = "api_caller"
    description = (
        "Send an HTTP request to an external API and return the response. "
        "Supports GET, POST, PUT, PATCH, DELETE with custom headers and body."
    )
    args_schema = ApiCallerInput

    async def execute(
        self, method: str, url: str, headers: str = "{}", body: str = "",
    ) -> str:
        timeout = self.config.get("timeout", 60)
        max_response_size = self.config.get("max_response_size", 8000)

        try:
            parsed_headers = json.loads(headers)
        except json.JSONDecodeError:
            parsed_headers = {}

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.request(
                method, url,
                headers=parsed_headers,
                content=body.encode() if body else None,
            )

        return json.dumps({
            "status_code": resp.status_code,
            "headers": dict(resp.headers),
            "body": resp.text[:max_response_size],
        }, ensure_ascii=False)
