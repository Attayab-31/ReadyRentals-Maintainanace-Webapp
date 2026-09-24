"""worker_flow_updates

Revision ID: 8e909d2b3d6b
Revises: 002_category_archive
Create Date: 2026-09-20 12:13:30.780825

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '8e909d2b3d6b'
down_revision: Union[str, None] = '002_category_archive'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    context = op.get_context()
    if context.dialect.name == "postgresql":
        op.execute(
            "DO $$ BEGIN "
            "IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN "
            "CREATE TYPE userrole AS ENUM ('owner', 'admin', 'manager'); "
            "END IF; "
            "IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workorderstatus') THEN "
            "CREATE TYPE workorderstatus AS ENUM ('assigned', 'in_progress', 'completed_pending_signoff', 'signed_off'); "
            "END IF; "
            "END $$;"
        )

    userrole_enum = sa.Enum('owner', 'admin', 'manager', name='userrole')
    workorderstatus_enum = sa.Enum('assigned', 'in_progress', 'completed_pending_signoff', 'signed_off', name='workorderstatus')

    if context.dialect.name == "postgresql":
        # PostgreSQL cannot cast a VARCHAR server default while changing the
        # column to an enum, so remove and restore the defaults around the cast.
        op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
        op.execute("ALTER TABLE work_orders ALTER COLUMN status DROP DEFAULT")

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column(
            'role',
            existing_type=sa.VARCHAR(length=32),
            type_=userrole_enum,
            existing_nullable=False,
            existing_server_default=None,
            postgresql_using='role::userrole',
        )

    if context.dialect.name == "postgresql":
        op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'manager'::userrole")
    else:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.alter_column(
                'role',
                existing_type=userrole_enum,
                server_default=sa.text("'manager'"),
            )

    with op.batch_alter_table('work_order_items', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('tech_notes', sa.String(), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column('before_photo_skipped', sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(
            sa.Column('after_photo_skipped', sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.alter_column(
            'details',
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=False,
            existing_server_default=sa.text("('')"),
        )
        batch_op.drop_index('ix_work_order_items_wo')
        batch_op.create_index('ix_work_order_items_work_order_id', ['work_order_id'], unique=False)

    with op.batch_alter_table('work_orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('worker_notified_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('worker_notify_error', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('manager_notified_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('manager_notify_error', sa.String(), nullable=True))
        batch_op.alter_column(
            'status',
            existing_type=sa.VARCHAR(length=64),
            type_=workorderstatus_enum,
            existing_nullable=False,
            existing_server_default=None,
            postgresql_using='status::workorderstatus',
        )
        batch_op.alter_column(
            'if_incomplete_explanation',
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'inspection_results',
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.drop_index('ix_work_orders_number')
        batch_op.drop_index('ix_work_orders_token')
        batch_op.create_index('ix_work_orders_work_order_number', ['work_order_number'], unique=True)
        batch_op.create_index('ix_work_orders_worker_access_token', ['worker_access_token'], unique=True)

    if context.dialect.name == "postgresql":
        op.execute("ALTER TABLE work_orders ALTER COLUMN status SET DEFAULT 'assigned'::workorderstatus")
    else:
        with op.batch_alter_table('work_orders', schema=None) as batch_op:
            batch_op.alter_column(
                'status',
                existing_type=workorderstatus_enum,
                server_default=sa.text("'assigned'"),
            )


def downgrade() -> None:
    context = op.get_context()
    if context.dialect.name == "postgresql":
        op.execute("ALTER TABLE work_orders ALTER COLUMN status DROP DEFAULT")

    with op.batch_alter_table('work_orders', schema=None) as batch_op:
        batch_op.drop_index('ix_work_orders_worker_access_token')
        batch_op.drop_index('ix_work_orders_work_order_number')
        batch_op.create_index('ix_work_orders_token', ['worker_access_token'], unique=1)
        batch_op.create_index('ix_work_orders_number', ['work_order_number'], unique=1)
        batch_op.alter_column(
            'inspection_results',
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'if_incomplete_explanation',
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'status',
            existing_type=sa.Enum('assigned', 'in_progress', 'completed_pending_signoff', 'signed_off', name='workorderstatus'),
            type_=sa.VARCHAR(length=64),
            existing_nullable=False,
            existing_server_default=None,
        )
        batch_op.drop_column('manager_notify_error')
        batch_op.drop_column('manager_notified_at')
        batch_op.drop_column('worker_notify_error')
        batch_op.drop_column('worker_notified_at')

    if context.dialect.name == "postgresql":
        op.execute("ALTER TABLE work_orders ALTER COLUMN status SET DEFAULT 'assigned'")
    else:
        with op.batch_alter_table('work_orders', schema=None) as batch_op:
            batch_op.alter_column(
                'status',
                existing_type=sa.Enum('assigned', 'in_progress', 'completed_pending_signoff', 'signed_off', name='workorderstatus'),
                server_default=sa.text("'assigned'"),
            )

    with op.batch_alter_table('work_order_items', schema=None) as batch_op:
        batch_op.drop_index('ix_work_order_items_work_order_id')
        batch_op.create_index('ix_work_order_items_wo', ['work_order_id'], unique=False)
        batch_op.alter_column(
            'details',
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=False,
            existing_server_default=sa.text("('')"),
        )
        batch_op.drop_column('after_photo_skipped')
        batch_op.drop_column('before_photo_skipped')
        batch_op.drop_column('tech_notes')

    if context.dialect.name == "postgresql":
        op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column(
            'role',
            existing_type=sa.Enum('owner', 'admin', 'manager', name='userrole'),
            type_=sa.VARCHAR(length=32),
            existing_nullable=False,
            existing_server_default=None,
        )

    if context.dialect.name == "postgresql":
        op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'manager'")
    else:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.alter_column(
                'role',
                existing_type=sa.VARCHAR(length=32),
                server_default=sa.text("'manager'"),
            )
