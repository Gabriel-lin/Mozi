"""add_workflow_tables

Revision ID: a3f7c8d91b02
Revises: 251988f46ee0
Create Date: 2026-03-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a3f7c8d91b02"
down_revision: Union[str, None] = "251988f46ee0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    workflow_status = sa.Enum("draft", "active", "archived", name="workflow_status")
    workflow_run_status = sa.Enum(
        "idle", "running", "completed", "failed", "cancelled", "paused",
        name="workflow_run_status",
    )

    op.create_table(
        "workflows",
        sa.Column("id", sa.String(21), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("status", workflow_status, nullable=False, server_default="draft"),
        sa.Column(
            "workspace_id",
            sa.String(21),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            sa.String(21),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "workflow_versions",
        sa.Column("id", sa.String(21), primary_key=True),
        sa.Column(
            "workflow_id",
            sa.String(21),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("graph_data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("change_log", sa.String(500), nullable=True),
        sa.Column(
            "created_by",
            sa.String(21),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.String(21), primary_key=True),
        sa.Column(
            "workflow_id",
            sa.String(21),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "version_id",
            sa.String(21),
            sa.ForeignKey("workflow_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", workflow_run_status, nullable=False, server_default="idle"),
        sa.Column("input_data", postgresql.JSONB(), nullable=True),
        sa.Column("output_data", postgresql.JSONB(), nullable=True),
        sa.Column("node_results", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "triggered_by", sa.String(21), sa.ForeignKey("users.id"), nullable=True
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("workflow_runs")
    op.drop_table("workflow_versions")
    op.drop_table("workflows")
    op.execute("DROP TYPE workflow_run_status")
    op.execute("DROP TYPE workflow_status")
