"""agent_runs: conversation JSONB for multi-turn UI persistence

Revision ID: e2b4c9d01a11
Revises: f1a2b3c04d00
Create Date: 2026-05-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "e2b4c9d01a11"
down_revision: Union[str, None] = "f1a2b3c04d00"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("conversation", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "conversation")
