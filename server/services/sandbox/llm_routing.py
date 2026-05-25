"""Resolve chat models to vendor-specific base URLs and API keys (not a single vLLM default)."""

from __future__ import annotations

from typing import Literal

import structlog
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from shared.config import get_settings

log = structlog.get_logger()
settings = get_settings()

Vendor = Literal["openai", "anthropic", "google", "deepseek", "vllm"]


def _require(msg: str) -> None:
    raise RuntimeError(msg)


def _parse_model_tag(model: str) -> tuple[str, Vendor | None]:
    """Support ``vendor/model-id`` (e.g. ``openai/gpt-4o``, ``vllm/mozi-default``)."""
    m = model.strip()
    if "/" not in m:
        return m, None
    prefix, rest = m.split("/", 1)
    p = prefix.strip().lower()
    r = rest.strip()
    if p in ("openai", "anthropic", "google", "deepseek", "vllm", "local"):
        v: Vendor = "vllm" if p == "local" else p  # type: ignore[assignment]
        return r, v
    return m, None


def infer_vendor(model_id: str, explicit: Vendor | None) -> Vendor:
    if explicit:
        return explicit
    mid = model_id.strip().lower()
    if mid == settings.vllm_model.lower() or mid == "mozi-default":
        return "vllm"
    if mid.startswith("claude"):
        return "anthropic"
    if mid.startswith("gemini") or mid.startswith("models/gemini"):
        return "google"
    if "deepseek" in mid:
        return "deepseek"
    if any(
        mid.startswith(p)
        for p in (
            "gpt-",
            "o1",
            "o3",
            "o4",
            "chatgpt-",
            "davinci",
            "ft:",
        )
    ):
        return "openai"
    if settings.openai_api_key:
        return "openai"
    if settings.deepseek_api_key:
        return "deepseek"
    if settings.anthropic_api_key:
        return "anthropic"
    if settings.google_api_key:
        return "google"
    _require(
        f"未识别的模型 {model_id!r}，且未配置可用的云厂商 Key。"
        f"请设置 MOZI_OPENAI_API_KEY（或 DeepSeek / Anthropic / Google 等），"
        f"或使用显式标签如 openai/gpt-4o、deepseek/deepseek-chat，"
        f"或本地模型名 {settings.vllm_model!r} / mozi-default（并配置 MOZI_VLLM_BASE_URL）。"
    )


def apply_llm_provider_prefix(model: str | None, agent_config: dict | None) -> str | None:
    """Use ``config.llm_provider`` from the agent editor so routing matches the UI.

    Without this, :func:`infer_vendor` may pick the wrong cloud (e.g. OpenAI) when the
    model id looks like ``gpt-*`` or when both ``MOZI_OPENAI_API_KEY`` and
    ``MOZI_DEEPSEEK_API_KEY`` are set but only DeepSeek should be used.
    """
    raw = (model or "").strip()
    if not raw:
        return None
    if "/" in raw:
        return raw
    cfg = agent_config or {}
    prov = str(cfg.get("llm_provider") or "").strip().lower()
    if not prov:
        return raw
    tag_map = {
        "openai": "openai",
        "anthropic": "anthropic",
        "google": "google",
        "deepseek": "deepseek",
        "ollama": "vllm",
    }
    prefix = tag_map.get(prov)
    if not prefix:
        return raw
    return f"{prefix}/{raw}"


def resolve_effective_model_id(model: str | None) -> str:
    """Model id after optional ``vendor/`` prefix and default selection (for logging / meta)."""
    raw = (model or "").strip()
    if not raw:
        if settings.openai_api_key:
            raw = settings.default_llm_model
        elif settings.anthropic_api_key:
            raw = settings.anthropic_default_model
        elif settings.google_api_key:
            raw = settings.google_default_model
        elif settings.deepseek_api_key:
            raw = settings.deepseek_default_model
        else:
            raw = settings.vllm_model
    model_id, _ = _parse_model_tag(raw)
    return model_id


def resolve_vendor_meta(model: str | None) -> tuple[Vendor | None, str | None]:
    """Return ``(vendor, base_url)`` without instantiating a chat client.

    Used by error reporting paths to tell the user which endpoint the worker actually
    targeted, without re-running the full :func:`build_chat_model` machinery.
    """
    raw = (model or "").strip()
    if not raw:
        return (None, None)
    model_id, tag = _parse_model_tag(raw)
    try:
        vendor = infer_vendor(model_id, tag)
    except RuntimeError:
        return (None, None)
    base_url: str | None
    if vendor == "vllm":
        base_url = settings.vllm_base_url
    elif vendor == "openai":
        base_url = settings.openai_base_url
    elif vendor == "deepseek":
        base_url = settings.deepseek_base_url
    elif vendor == "anthropic":
        base_url = settings.anthropic_base_url or "https://api.anthropic.com"
    elif vendor == "google":
        base_url = "https://generativelanguage.googleapis.com"
    else:
        base_url = None
    return (vendor, base_url)


def build_chat_model(model: str | None, temperature: float = 0.2) -> BaseChatModel:
    """Instantiate the correct vendor chat model using that vendor's base URL and API key."""
    raw = (model or "").strip()
    if not raw:
        if settings.openai_api_key:
            raw = settings.default_llm_model
        elif settings.anthropic_api_key:
            raw = settings.anthropic_default_model
        elif settings.google_api_key:
            raw = settings.google_default_model
        elif settings.deepseek_api_key:
            raw = settings.deepseek_default_model
        else:
            raw = settings.vllm_model

    model_id, tag = _parse_model_tag(raw)
    vendor = infer_vendor(model_id, tag)

    if vendor == "vllm":
        key = (settings.vllm_api_key or "").strip() or "EMPTY"
        log.info("llm_route", vendor="vllm", model=model_id, base_url=settings.vllm_base_url)
        return ChatOpenAI(
            base_url=settings.vllm_base_url,
            api_key=key,
            model=model_id,
            temperature=temperature,
            timeout=settings.llm_request_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    if vendor == "openai":
        if not settings.openai_api_key:
            _require(
                "OpenAI 路由需要设置 MOZI_OPENAI_API_KEY（以及可选的 MOZI_OPENAI_BASE_URL）。"
                "当前模型被识别为 OpenAI 系列。"
            )
        log.info("llm_route", vendor="openai", model=model_id, base_url=settings.openai_base_url)
        return ChatOpenAI(
            base_url=settings.openai_base_url,
            api_key=settings.openai_api_key,
            model=model_id,
            temperature=temperature,
            timeout=settings.llm_request_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    if vendor == "deepseek":
        if not settings.deepseek_api_key:
            _require(
                "DeepSeek 路由需要设置 MOZI_DEEPSEEK_API_KEY（及可选 MOZI_DEEPSEEK_BASE_URL）。"
            )
        log.info(
            "llm_route",
            vendor="deepseek",
            model=model_id,
            base_url=settings.deepseek_base_url,
        )
        return ChatOpenAI(
            base_url=settings.deepseek_base_url,
            api_key=settings.deepseek_api_key,
            model=model_id,
            temperature=temperature,
            timeout=settings.llm_request_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    if vendor == "anthropic":
        if not settings.anthropic_api_key:
            _require(
                "Anthropic 路由需要设置 MOZI_ANTHROPIC_API_KEY（及可选 MOZI_ANTHROPIC_BASE_URL）。"
            )
        kwargs: dict = {
            "model": model_id,
            "api_key": settings.anthropic_api_key,
            "temperature": temperature,
        }
        if settings.anthropic_base_url:
            kwargs["base_url"] = settings.anthropic_base_url
        log.info(
            "llm_route",
            vendor="anthropic",
            model=model_id,
            base_url=settings.anthropic_base_url or "(default)",
        )
        return ChatAnthropic(**kwargs)

    if vendor == "google":
        if not settings.google_api_key:
            _require("Google Gemini 路由需要设置 MOZI_GOOGLE_API_KEY。")
        log.info("llm_route", vendor="google", model=model_id)
        return ChatGoogleGenerativeAI(
            model=model_id,
            google_api_key=settings.google_api_key,
            temperature=temperature,
        )

    _require(f"内部错误：未处理的供应商 {vendor!r}")
