from datetime import date
from typing import Dict, Iterable, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from . import models


def _resolve_direction(direction: str | models.BookingDirection) -> models.BookingDirection:
    if isinstance(direction, models.BookingDirection):
        return direction
    try:
        return models.BookingDirection(direction)
    except Exception as exc:  # pylint: disable=broad-except
        raise ValueError("booking_type must be 'in' or 'out'") from exc


def get_quota_for_date(
    db: Session,
    object_id: int,
    transport_type_id: int | None,
    target_date: date,
    direction: str | models.BookingDirection,
) -> Tuple[models.VolumeQuota | None, float | None]:
    """Return (quota, total_volume_for_date) for given filters or (None, None) if not found."""
    if not transport_type_id:
        return None, None

    direction_enum = _resolve_direction(direction)
    quota = (
        db.query(models.VolumeQuota)
        .join(models.VolumeQuota.transport_types)
        .options(joinedload(models.VolumeQuota.overrides))
        .filter(
            models.VolumeQuota.object_id == object_id,
            models.VolumeQuota.direction == direction_enum,
            models.VolumeQuota.year == target_date.year,
            models.VolumeQuota.month == target_date.month,
            models.VolumeQuota.day_of_week == target_date.weekday(),
            models.TransportTypeRef.id == transport_type_id,
        )
        .first()
    )

    if not quota:
        return None, None

    override = next((ov for ov in quota.overrides if ov.override_date == target_date), None)
    total_volume = override.volume if override else quota.volume
    return quota, total_volume


def calculate_used_volume(
    db: Session,
    object_id: int,
    transport_type_id: int | None,
    target_date: date,
    direction: str | models.BookingDirection,
) -> float:
    """Sum confirmed booking cubes for the date/object/transport_type/direction."""
    if not transport_type_id:
        return 0.0

    direction_enum = _resolve_direction(direction)
    booking_sub = (
        db.query(
            models.BookingTimeSlot.booking_id.label("booking_id"),
            models.TimeSlot.slot_date.label("slot_date"),
        )
        .join(models.TimeSlot, models.BookingTimeSlot.time_slot_id == models.TimeSlot.id)
        .join(models.Dock, models.TimeSlot.dock_id == models.Dock.id)
        .join(models.Booking, models.Booking.id == models.BookingTimeSlot.booking_id)
        .filter(
            models.TimeSlot.slot_date == target_date,
            models.Dock.object_id == object_id,
            models.Booking.transport_type_id == transport_type_id,
            models.Booking.status == "confirmed",
            models.Booking.booking_type == direction_enum,
        )
        .distinct()
        .subquery()
    )

    used_volume = (
        db.query(func.coalesce(func.sum(func.coalesce(models.Booking.cubes, 0.0)), 0.0))
        .join(booking_sub, booking_sub.c.booking_id == models.Booking.id)
        .scalar()
        or 0.0
    )
    return float(used_volume)


def used_volume_by_date(
    db: Session,
    object_id: int,
    transport_type_id: int | None,
    start_date: date,
    end_date: date,
    direction: str | models.BookingDirection,
) -> Dict[date, float]:
    """Return mapping slot_date -> used volume for range with the given filters."""
    if not transport_type_id:
        return {}

    direction_enum = _resolve_direction(direction)
    booking_sub = (
        db.query(
            models.BookingTimeSlot.booking_id.label("booking_id"),
            models.TimeSlot.slot_date.label("slot_date"),
        )
        .join(models.TimeSlot, models.BookingTimeSlot.time_slot_id == models.TimeSlot.id)
        .join(models.Dock, models.TimeSlot.dock_id == models.Dock.id)
        .join(models.Booking, models.Booking.id == models.BookingTimeSlot.booking_id)
        .filter(
            models.TimeSlot.slot_date >= start_date,
            models.TimeSlot.slot_date <= end_date,
            models.Dock.object_id == object_id,
            models.Booking.transport_type_id == transport_type_id,
            models.Booking.status == "confirmed",
            models.Booking.booking_type == direction_enum,
        )
        .distinct()
        .subquery()
    )

    rows = (
        db.query(
            booking_sub.c.slot_date,
            func.coalesce(func.sum(func.coalesce(models.Booking.cubes, 0.0)), 0.0).label("used"),
        )
        .join(models.Booking, models.Booking.id == booking_sub.c.booking_id)
        .group_by(booking_sub.c.slot_date)
        .all()
    )

    return {row.slot_date: float(row.used or 0.0) for row in rows}


def first_by_predicate(items: Iterable[models.VolumeQuota], predicate) -> models.VolumeQuota | None:
    for item in items:
        if predicate(item):
            return item
    return None


def resolve_direction(direction: str | models.BookingDirection) -> models.BookingDirection:
    """Public wrapper to normalize direction values."""
    return _resolve_direction(direction)
