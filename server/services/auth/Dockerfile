FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

COPY shared/ shared/
COPY services/__init__.py services/__init__.py
COPY services/auth/ services/auth/

EXPOSE 3001

CMD ["uv", "run", "uvicorn", "services.auth.main:app", "--host", "0.0.0.0", "--port", "3001"]
