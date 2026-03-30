"""Entrypoint: run Celery worker for sandbox execution.

Usage:
    uv run celery -A services.sandbox.main:celery_app worker -Q agent-runs -c 2 --loglevel=info
"""

from .tasks import celery_app

__all__ = ["celery_app"]
