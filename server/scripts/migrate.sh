#!/usr/bin/env bash
set -euo pipefail

echo "==> Running Alembic migrations …"
PYTHONPATH=/app uv run alembic upgrade head
echo "==> Migrations complete."

if [ $# -gt 0 ]; then
  echo "==> Starting: $*"
  exec "$@"
fi
