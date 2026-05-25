from __future__ import annotations

import json

from pydantic import BaseModel, Field

from ._base import BuiltinTool, register


class ImageAnalyzerInput(BaseModel):
    image_url: str = Field(description="URL of the image to analyze")
    question: str = Field(
        default="Describe this image in detail.",
        description="Specific question about the image",
    )


@register("image_analyzer")
class ImageAnalyzerTool(BuiltinTool):
    name = "image_analyzer"
    description = (
        "Analyze an image by URL using a multimodal LLM. "
        "Can describe the image or answer specific questions about it."
    )
    args_schema = ImageAnalyzerInput

    async def execute(
        self, image_url: str, question: str = "Describe this image in detail.",
    ) -> str:
        from shared.config import get_settings
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage

        settings = get_settings()
        llm = ChatOpenAI(
            base_url=self.config.get("llm_base_url") or settings.vllm_base_url,
            api_key=self.config.get("llm_api_key") or "EMPTY",
            model=(
                self.config.get("vision_model")
                or self.config.get("llm_model")
                or settings.vllm_model
            ),
            temperature=0.3,
        )

        message = HumanMessage(content=[
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": image_url}},
        ])

        resp = await llm.ainvoke([message])
        analysis = resp.content if hasattr(resp, "content") else str(resp)
        return json.dumps(
            {"image_url": image_url, "analysis": analysis},
            ensure_ascii=False,
        )
