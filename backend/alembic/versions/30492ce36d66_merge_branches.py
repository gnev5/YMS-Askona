"""Merge branches

Revision ID: 30492ce36d66
Revises: d074798221ed, make_booking_fields_nullable
Create Date: 2026-01-03 10:26:56.329437

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30492ce36d66'
down_revision: Union[str, None] = ('d074798221ed', 'make_booking_fields_nullable')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
