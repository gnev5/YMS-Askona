"""Add data comparison module tables

Revision ID: 9b8c7d6e5f4a
Revises: b674c34706ca
Create Date: 2026-07-18 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "9b8c7d6e5f4a"
down_revision: Union[str, None] = "b674c34706ca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_type():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.JSONB(astext_type=sa.Text())
    return sa.JSON()


def upgrade() -> None:
    direction_enum = sa.Enum("in", "out", name="bookingdirection")
    direction_enum.create(op.get_bind(), checkfirst=True)
    json_type = _json_type()

    op.create_table(
        "data_comparison_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("object_id", sa.Integer(), sa.ForeignKey("objects.id"), nullable=False),
        sa.Column("direction", postgresql.ENUM("in", "out", name="bookingdirection", create_type=False), nullable=False),
        sa.Column("tl_column_name", sa.String(length=100), nullable=False, server_default="Номер ТЛ"),
        sa.Column("status_filters", json_type, nullable=False, server_default='["confirmed"]'),
        sa.Column("yms_filters", json_type, nullable=False, server_default="{}"),
        sa.Column("file_settings", json_type, nullable=False, server_default="{}"),
        sa.Column("comparison_settings", json_type, nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_data_comparison_profiles_name"),
    )
    op.create_index("ix_data_comparison_profiles_object_id", "data_comparison_profiles", ["object_id"])
    op.create_index("ix_data_comparison_profiles_direction", "data_comparison_profiles", ["direction"])
    op.create_index("ix_data_comparison_profiles_is_active", "data_comparison_profiles", ["is_active"])

    op.create_table(
        "data_comparison_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("data_comparison_profiles.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("extended_date_from", sa.Date(), nullable=False),
        sa.Column("extended_date_to", sa.Date(), nullable=False),
        sa.Column("source_file_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
        sa.Column("summary", json_type, nullable=False, server_default="{}"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_data_comparison_runs_profile_id", "data_comparison_runs", ["profile_id"])
    op.create_index("ix_data_comparison_runs_user_id", "data_comparison_runs", ["user_id"])
    op.create_index("ix_data_comparison_runs_status", "data_comparison_runs", ["status"])
    op.create_index("ix_data_comparison_runs_created_at", "data_comparison_runs", ["created_at"])
    op.create_index("ix_data_comparison_runs_period", "data_comparison_runs", ["date_from", "date_to"])

    op.create_table(
        "data_comparison_run_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("data_comparison_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tl_number_original", sa.String(length=100), nullable=True),
        sa.Column("tl_number_normalized", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("file_row_number", sa.Integer(), nullable=True),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("file_data", json_type, nullable=True),
        sa.Column("yms_data", json_type, nullable=True),
        sa.Column("differences", json_type, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_data_comparison_run_rows_run_id", "data_comparison_run_rows", ["run_id"])
    op.create_index("ix_data_comparison_run_rows_tl_number_normalized", "data_comparison_run_rows", ["tl_number_normalized"])
    op.create_index("ix_data_comparison_run_rows_status", "data_comparison_run_rows", ["status"])
    op.create_index("ix_data_comparison_run_rows_run_status", "data_comparison_run_rows", ["run_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_data_comparison_run_rows_run_status", table_name="data_comparison_run_rows")
    op.drop_index("ix_data_comparison_run_rows_status", table_name="data_comparison_run_rows")
    op.drop_index("ix_data_comparison_run_rows_tl_number_normalized", table_name="data_comparison_run_rows")
    op.drop_index("ix_data_comparison_run_rows_run_id", table_name="data_comparison_run_rows")
    op.drop_table("data_comparison_run_rows")

    op.drop_index("ix_data_comparison_runs_period", table_name="data_comparison_runs")
    op.drop_index("ix_data_comparison_runs_created_at", table_name="data_comparison_runs")
    op.drop_index("ix_data_comparison_runs_status", table_name="data_comparison_runs")
    op.drop_index("ix_data_comparison_runs_user_id", table_name="data_comparison_runs")
    op.drop_index("ix_data_comparison_runs_profile_id", table_name="data_comparison_runs")
    op.drop_table("data_comparison_runs")

    op.drop_index("ix_data_comparison_profiles_is_active", table_name="data_comparison_profiles")
    op.drop_index("ix_data_comparison_profiles_direction", table_name="data_comparison_profiles")
    op.drop_index("ix_data_comparison_profiles_object_id", table_name="data_comparison_profiles")
    op.drop_table("data_comparison_profiles")
