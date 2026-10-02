"""Track whether a work item requires a before photo.

Revision ID: 5b3c7d9e1f24
Revises: e91a7b3c5d20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5b3c7d9e1f24"
down_revision: Union[str, None] = "e91a7b3c5d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_order_items",
        sa.Column(
            "before_photo_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("work_order_items", "before_photo_required")
