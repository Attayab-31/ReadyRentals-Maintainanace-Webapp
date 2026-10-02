"""Add soft-delete timestamp for the owner work-order recycle bin.

Revision ID: e91a7b3c5d20
Revises: d4a8f19c2b60
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e91a7b3c5d20"
down_revision: Union[str, None] = "d4a8f19c2b60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_work_orders_deleted_at",
        "work_orders",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_work_orders_deleted_at", table_name="work_orders")
    op.drop_column("work_orders", "deleted_at")
