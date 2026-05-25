from __future__ import annotations

import json

from pydantic import BaseModel, Field

from ._base import BuiltinTool, register


class TextSummarizerInput(BaseModel):
    text: str = Field(description="Text to summarize")
    max_length: int = Field(default=500, ge=50, le=5000, description="Maximum summary length")
    language: str = Field(default="auto", description="Output language (auto / zh / en)")


@register("text_summarizer")
class TextSummarizerTool(BuiltinTool):
    name = "text_summarizer"
    description = (
        "Summarize a long text into a concise version using an LLM. "
        "Supports specifying target language and max length."
    )
    args_schema = TextSummarizerInput

    async def execute(
        self, text: str, max_length: int = 500, language: str = "auto",
    ) -> str:
        from shared.config import get_settings
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        llm = ChatOpenAI(
            base_url=self.config.get("llm_base_url") or settings.vllm_base_url,
            api_key=self.config.get("llm_api_key") or "EMPTY",
            model=self.config.get("llm_model") or settings.vllm_model,
            temperature=0.3,
        )

        lang_hint = {"zh": "用中文", "en": "in English"}.get(language, "")
        prompt = (
            f"请将以下文本总结为不超过 {max_length} 字的摘要{lang_hint}。"
            f"只返回摘要内容，不要添加任何额外说明。\n\n{text[:10000]}"
        )

        resp = await llm.ainvoke(prompt)
        summary = resp.content if hasattr(resp, "content") else str(resp)
        return json.dumps(
            {"summary": summary, "original_length": len(text)},
            ensure_ascii=False,
        )
