"""Store technician email and assignment email delivery status.

Revision ID: c4d8e2a6f901
Revises: b7f2c4a9d1e0
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d8e2a6f901"
down_revision: Union[str, None] = "b7f2c4a9d1e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders", sa.Column("assigned_to_email", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "work_orders", sa.Column("worker_email_notified_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "work_orders", sa.Column("worker_email_notify_error", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("work_orders", "worker_email_notify_error")
    op.drop_column("work_orders", "worker_email_notified_at")
    op.drop_column("work_orders", "assigned_to_email")
