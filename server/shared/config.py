from pydantic_settings import BaseSettings
from functools import lru_cache


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

    # vLLM
    vllm_base_url: str = "http://localhost:8000/v1"
    vllm_model: str = "mozi-default"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False

    # MCP
    mcp_server_name: str = "mozi"
    mcp_server_version: str = "0.1.0"

    model_config = {"env_prefix": "MOZI_", "env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
