FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

COPY shared/ shared/
COPY services/__init__.py services/__init__.py
COPY services/agent/ services/agent/
COPY services/sandbox/ services/sandbox/

CMD ["uv", "run", "celery", "-A", "services.sandbox.main:celery_app", "worker", "-Q", "agent-runs", "-c", "2", "--loglevel=info"]
