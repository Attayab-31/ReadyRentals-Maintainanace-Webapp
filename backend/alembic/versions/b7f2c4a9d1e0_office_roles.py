"""Remove the legacy manager user role.

Revision ID: b7f2c4a9d1e0
Revises: a1b2c3d4e5f6
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7f2c4a9d1e0"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        # Preserve access for existing staff before removing the enum value.
        op.execute("UPDATE users SET role = 'admin' WHERE role::text = 'manager'")
        op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
        op.execute("ALTER TYPE userrole RENAME TO userrole_legacy")
        op.execute("CREATE TYPE userrole AS ENUM ('owner', 'admin')")
        op.execute(
            "ALTER TABLE users ALTER COLUMN role TYPE userrole "
            "USING role::text::userrole"
        )
        op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'admin'::userrole")
        op.execute("DROP TYPE userrole_legacy")
        return

    op.execute("UPDATE users SET role = 'admin' WHERE role = 'manager'")
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "role",
            existing_type=sa.Enum("owner", "admin", "manager", name="userrole"),
            type_=sa.Enum("owner", "admin", name="userrole"),
            existing_nullable=False,
            existing_server_default=sa.text("'manager'"),
            server_default=sa.text("'admin'"),
        )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
        op.execute("ALTER TYPE userrole RENAME TO userrole_current")
        op.execute("CREATE TYPE userrole AS ENUM ('owner', 'admin', 'manager')")
        op.execute(
            "ALTER TABLE users ALTER COLUMN role TYPE userrole "
            "USING role::text::userrole"
        )
        op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'manager'::userrole")
        op.execute("DROP TYPE userrole_current")
        return

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "role",
            existing_type=sa.Enum("owner", "admin", name="userrole"),
            type_=sa.Enum("owner", "admin", "manager", name="userrole"),
            existing_nullable=False,
            existing_server_default=sa.text("'admin'"),
            server_default=sa.text("'manager'"),
        )
