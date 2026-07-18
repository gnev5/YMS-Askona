"""Add Excel column and row range to comparison profiles

Revision ID: a1b2c3d4e5f6
Revises: 9b8c7d6e5f4a
Create Date: 2026-07-18 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9b8c7d6e5f4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("data_comparison_profiles", sa.Column("tl_column_letter", sa.String(length=10), nullable=True))
    op.add_column("data_comparison_profiles", sa.Column("file_start_row", sa.Integer(), nullable=False, server_default="2"))
    op.add_column("data_comparison_profiles", sa.Column("file_end_row", sa.Integer(), nullable=True))
    op.alter_column("data_comparison_profiles", "file_start_row", server_default=None)


def downgrade() -> None:
    op.drop_column("data_comparison_profiles", "file_end_row")
    op.drop_column("data_comparison_profiles", "file_start_row")
    op.drop_column("data_comparison_profiles", "tl_column_letter")
