"""add category archive state

Revision ID: 002_category_archive
Revises: 001_initial
"""

from alembic import op
import sqlalchemy as sa


revision = "002_category_archive"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "checklist_categories",
        sa.Column("is_active", sa.Boolean(),
                  nullable=False, server_default=sa.true()),
    )
    op.create_index(
        "ix_checklist_categories_is_active",
        "checklist_categories",
        ["is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_checklist_categories_is_active",
                  table_name="checklist_categories")
    op.drop_column("checklist_categories", "is_active")
