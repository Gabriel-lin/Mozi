from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load `server/.env` regardless of process cwd (uvicorn/celery may start from repo root).
_SERVER_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Server
    env: str = "development"
    debug: bool = True

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://mozi:mozi_secret@localhost:5432/mozi"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret: str = "change-me-to-a-random-64-char-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "tauri://localhost"]

    # vLLM / local OpenAI-compatible (only when model is MOZI_VLLM_MODEL or mozi-default)
    vllm_base_url: str = "http://localhost:8000/v1"
    vllm_model: str = "mozi-default"
    vllm_api_key: str | None = None  # optional bearer if your gateway requires it

    # OpenAI (official or Azure-compatible: set base URL to your deployment)
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"

    # Anthropic
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    anthropic_default_model: str = "claude-3-5-sonnet-20241022"

    # Google Gemini
    google_api_key: str | None = None
    google_default_model: str = "gemini-2.0-flash"

    # DeepSeek (OpenAI-compatible HTTP)
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_default_model: str = "deepseek-chat"

    # Default chat model when creating agents / empty model (uses first configured vendor)
    default_llm_model: str = "gpt-5.4"
    llm_request_timeout_seconds: float = 120.0
    # DeepSeek/Vendor endpoints can occasionally stall mid-stream (network/proxy blips).
    # Retries make agent runs more resilient than failing the whole task on the first stall.
    llm_max_retries: int = 2
    agent_run_timeout_seconds: float = 240.0

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False

    # Local skills directories (~/.Mozi/skills, ~/.agents/skills) use this home.
    # In Docker, set to the host user home if the agent service should see the same tree.
    user_home: str | None = None

    # MCP
    mcp_server_name: str = "mozi"
    mcp_server_version: str = "0.1.0"
    mcp_streamable_path: str = "/api/v1/mcp"
    mcp_proxy_http_timeout_seconds: int = 30

    model_config = SettingsConfigDict(
        env_prefix="MOZI_",
        env_file=_SERVER_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
