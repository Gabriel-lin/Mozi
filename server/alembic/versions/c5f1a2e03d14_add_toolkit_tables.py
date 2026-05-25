"""add_toolkit_tables

Revision ID: c5f1a2e03d14
Revises: b4e8d9f02c13
Create Date: 2026-04-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5f1a2e03d14"
down_revision: Union[str, None] = "b4e8d9f02c13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "toolkits",
        sa.Column("id", sa.String(length=21), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("version", sa.String(length=30), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("icon", sa.String(length=100), nullable=True),
        sa.Column(
            "source",
            sa.Enum("builtin", "mcp", "custom", name="toolkit_source"),
            nullable=False,
            server_default="builtin",
        ),
        sa.Column("executor_key", sa.String(length=100), nullable=True),
        sa.Column(
            "mcp_server_id", sa.String(length=21), nullable=True,
        ),
        sa.Column("config_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["mcp_server_id"], ["mcp_servers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "workspace_toolkits",
        sa.Column("workspace_id", sa.String(length=21), nullable=False),
        sa.Column("toolkit_id", sa.String(length=21), nullable=False),
        sa.Column("config_override", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("installed_by", sa.String(length=21), nullable=True),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["toolkit_id"], ["toolkits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["installed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("workspace_id", "toolkit_id"),
    )


def downgrade() -> None:
    op.drop_table("workspace_toolkits")
    op.drop_table("toolkits")
    op.execute("DROP TYPE IF EXISTS toolkit_source")
