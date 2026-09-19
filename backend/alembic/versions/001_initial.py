"""initial schema + lookup seeds

Revision ID: 001_initial
Revises:
Create Date: 2026-09-17
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "priorities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("hour_target", sa.Integer(), nullable=False),
    )
    op.create_index("ix_priorities_code", "priorities", ["code"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="manager"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "checklist_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
    )
    op.create_index("ix_checklist_categories_name", "checklist_categories", ["name"], unique=True)

    op.create_table(
        "work_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_number", sa.String(length=32), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to_name", sa.String(length=255), nullable=False),
        sa.Column("assigned_to_phone", sa.String(length=32), nullable=False),
        sa.Column("date_assigned", sa.Date(), nullable=False),
        sa.Column("service_address", sa.String(length=512), nullable=False),
        sa.Column("tenant_names", sa.String(length=512), nullable=False),
        sa.Column("tenant_phone", sa.String(length=32), nullable=True),
        sa.Column("priority_id", sa.Integer(), sa.ForeignKey("priorities.id"), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="assigned"),
        sa.Column("service_date", sa.Date(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("if_incomplete_explanation", sa.Text(), nullable=True),
        sa.Column("return_date", sa.Date(), nullable=True),
        sa.Column("entire_unit_inspected", sa.Boolean(), nullable=True),
        sa.Column("inspection_results", sa.Text(), nullable=True),
        sa.Column("tenant_signature_url", sa.String(), nullable=True),
        sa.Column("tenant_signature_name", sa.String(length=255), nullable=True),
        sa.Column("tenant_signature_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tech_signature_url", sa.String(), nullable=True),
        sa.Column("tech_signature_name", sa.String(length=255), nullable=True),
        sa.Column("tech_signature_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("worker_access_token", sa.String(length=64), nullable=False),
        sa.Column("pdf_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_work_orders_number", "work_orders", ["work_order_number"], unique=True)
    op.create_index("ix_work_orders_status", "work_orders", ["status"], unique=False)
    op.create_index("ix_work_orders_token", "work_orders", ["worker_access_token"], unique=True)

    op.create_table(
        "work_order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), sa.ForeignKey("work_orders.id"), nullable=False),
        sa.Column("category", sa.String(length=128), nullable=False),
        sa.Column("details", sa.Text(), nullable=False, server_default=""),
        sa.Column("before_photo_url", sa.String(), nullable=True),
        sa.Column("after_photo_url", sa.String(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("work_order_id", "sort_order", name="uq_item_sort"),
    )
    op.create_index("ix_work_order_items_wo", "work_order_items", ["work_order_id"])

    priorities = sa.table(
        "priorities",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("hour_target", sa.Integer),
    )
    op.bulk_insert(
        priorities,
        [
            {"code": "emergency", "name": "Emergency", "hour_target": 4},
            {"code": "urgent", "name": "Urgent", "hour_target": 24},
            {"code": "standard", "name": "Standard", "hour_target": 72},
        ],
    )

    categories = sa.table("checklist_categories", sa.column("name", sa.String))
    op.bulk_insert(
        categories,
        [
            {"name": "Interior Surfaces"},
            {"name": "Exterior Roof"},
            {"name": "Mechanical Equipment"},
            {"name": "Concrete Components"},
            {"name": "Handrails/Guardrails"},
            {"name": "Tub/Plumbing"},
            {"name": "Other"},
        ],
    )


def downgrade() -> None:
    op.drop_table("work_order_items")
    op.drop_table("work_orders")
    op.drop_table("checklist_categories")
    op.drop_table("users")
    op.drop_table("priorities")
