"""
One-off helper to add volume quota schema changes to an existing database.

Run:
    python -m app.migrate_volume_quotas
"""

from sqlalchemy import text, inspect

from .db import engine
from . import models


def ensure_booking_type_column():
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("bookings")]
        if "booking_type" in columns:
            return

        conn.execute(
            text(
                "ALTER TABLE bookings ADD COLUMN booking_type VARCHAR(10) NOT NULL DEFAULT 'in'"
            )
        )
        conn.execute(text("UPDATE bookings SET booking_type = 'in' WHERE booking_type IS NULL"))
        conn.commit()


def ensure_quota_tables():
    # Create new tables if they don't exist
    models.volume_quota_transport_types.create(bind=engine, checkfirst=True)
    models.VolumeQuota.__table__.create(bind=engine, checkfirst=True)
    models.VolumeQuotaOverride.__table__.create(bind=engine, checkfirst=True)


def run():
    ensure_booking_type_column()
    ensure_quota_tables()


if __name__ == "__main__":
    run()
    print("Volume quota migration completed.")
