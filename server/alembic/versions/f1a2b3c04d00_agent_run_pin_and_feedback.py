"""agent_runs: pinned_at, feedback

Revision ID: f1a2b3c04d00
Revises: d8a3c1b04e21
Create Date: 2026-04-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c04d00"
down_revision: Union[str, None] = "d8a3c1b04e21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "agent_runs",
        sa.Column("feedback", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "feedback")
    op.drop_column("agent_runs", "pinned_at")
