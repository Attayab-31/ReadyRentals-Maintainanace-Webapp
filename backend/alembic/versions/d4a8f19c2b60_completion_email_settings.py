"""Store owner-configurable completion email CC address."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4a8f19c2b60"
down_revision: Union[str, None] = "c4d8e2a6f901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "application_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("completion_email_cc", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("application_settings")
