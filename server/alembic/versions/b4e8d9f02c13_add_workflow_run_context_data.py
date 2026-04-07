"""add_workflow_run_context_data_and_pending_status

Revision ID: b4e8d9f02c13
Revises: a3f7c8d91b02
Create Date: 2026-04-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b4e8d9f02c13"
down_revision: Union[str, None] = "a3f7c8d91b02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workflow_runs",
        sa.Column("context_data", postgresql.JSONB(), nullable=True),
    )
    op.execute("ALTER TYPE workflow_run_status ADD VALUE IF NOT EXISTS 'pending'")


def downgrade() -> None:
    op.drop_column("workflow_runs", "context_data")
