"""Add volume quota tables

Revision ID: 7f1f88b04543
Revises: 30492ce36d66
Create Date: 2026-01-11 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "7f1f88b04543"
down_revision: Union[str, None] = "30492ce36d66"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reuse the existing bookingdirection enum if present; create if missing.
    direction_enum = sa.Enum("in", "out", name="bookingdirection")
    direction_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "volume_quotas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("object_id", sa.Integer(), sa.ForeignKey("objects.id"), nullable=False),
        sa.Column("direction", postgresql.ENUM("in", "out", name="bookingdirection", create_type=False), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=False),
        sa.Column("allow_overbooking", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "volume_quota_transport_types",
        sa.Column("quota_id", sa.Integer(), sa.ForeignKey("volume_quotas.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("transport_type_id", sa.Integer(), sa.ForeignKey("transport_types.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "volume_quota_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("quota_id", sa.Integer(), sa.ForeignKey("volume_quotas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("override_date", sa.Date(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=False),
        sa.UniqueConstraint("quota_id", "override_date", name="uq_quota_override_date"),
    )


def downgrade() -> None:
    op.drop_table("volume_quota_overrides")
    op.drop_table("volume_quota_transport_types")
    op.drop_table("volume_quotas")
