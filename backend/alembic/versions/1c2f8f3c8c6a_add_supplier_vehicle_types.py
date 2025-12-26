"""add supplier vehicle types m2m

Revision ID: 1c2f8f3c8c6a
Revises: f6402659de40
Create Date: 2025-12-24
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1c2f8f3c8c6a"
down_revision = "f6402659de40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "supplier_vehicle_type_association",
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("vehicle_type_id", sa.Integer(), sa.ForeignKey("vehicle_types.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("supplier_vehicle_type_association")
