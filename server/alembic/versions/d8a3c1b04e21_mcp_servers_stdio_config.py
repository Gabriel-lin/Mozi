"""mcp_servers: stdio + Cursor mcp.json definition_json, unique workspace+name

Revision ID: d8a3c1b04e21
Revises: c5f1a2e03d14
Create Date: 2026-04-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8a3c1b04e21"
down_revision: Union[str, None] = "c5f1a2e03d14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mcp_servers",
        sa.Column("definition_json", sa.Text(), server_default="{}", nullable=False),
    )
    op.alter_column("mcp_servers", "url", existing_type=sa.String(length=500), nullable=True)
    op.create_index(
        "uq_mcp_servers_workspace_name",
        "mcp_servers",
        ["workspace_id", "name"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_mcp_servers_workspace_name", table_name="mcp_servers")
    op.alter_column("mcp_servers", "url", existing_type=sa.String(length=500), nullable=False)
    op.drop_column("mcp_servers", "definition_json")
