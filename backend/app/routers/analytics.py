from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import date
from .. import models
from ..db import get_db
from ..deps import get_current_user

router = APIRouter()


@router.get("/bookings-by-day")
def get_bookings_by_day(
    start_date: date,
    end_date: date,
    transport_type_id: int = None,
    supplier_id: int = None,
    object_id: int = None,
    dock_type: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получение статистики по количеству записей и кубов по дням"""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Subquery to select distinct bookings per day
    subquery = (
        db.query(
            models.Booking.id.label("booking_id"),
            cast(models.TimeSlot.slot_date, Date).label("slot_date")
        )
        .join(models.BookingTimeSlot, models.BookingTimeSlot.booking_id == models.Booking.id)
        .join(models.TimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id)
        .join(models.Dock, models.Dock.id == models.TimeSlot.dock_id)
        .filter(
            models.TimeSlot.slot_date >= start_date,
            models.TimeSlot.slot_date <= end_date,
            models.Booking.status != "cancelled"
        )
    )

    if transport_type_id is not None:
        subquery = subquery.filter(models.Booking.transport_type_id == transport_type_id)
    if supplier_id is not None:
        subquery = subquery.filter(models.Booking.supplier_id == supplier_id)
    if object_id is not None:
        subquery = subquery.filter(models.Dock.object_id == object_id)
    if dock_type is not None:
        try:
            dock_type_enum = models.DockType(dock_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dock_type")
        subquery = subquery.filter(models.Dock.dock_type == dock_type_enum)

    subquery = subquery.distinct().subquery()

    # Main query to aggregate results
    query = (
        db.query(
            subquery.c.slot_date.label("date"),
            func.count(subquery.c.booking_id).label("count"),
            func.coalesce(func.sum(models.Booking.cubes), 0).label("cubes")
        )
        .join(models.Booking, models.Booking.id == subquery.c.booking_id)
        .group_by(subquery.c.slot_date)
        .order_by(subquery.c.slot_date)
    )

    results = []
    for row in query.all():
        results.append({
            "date": row.date.isoformat(),
            "count": row.count,
            "cubes": float(row.cubes) if row.cubes is not None else 0.0
        })

    return results


@router.get("/bookings-by-zone")
def get_bookings_by_zone(
    start_date: date,
    end_date: date,
    transport_type_id: int = None,
    supplier_id: int = None,
    object_id: int = None,
    dock_type: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получение статистики по количеству записей и кубов по зонам"""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Subquery to get distinct bookings that have slots in the date range
    subquery = (
        db.query(models.Booking.id.label("booking_id"))
        .join(models.BookingTimeSlot, models.BookingTimeSlot.booking_id == models.Booking.id)
        .join(models.TimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id)
        .join(models.Dock, models.Dock.id == models.TimeSlot.dock_id)
        .filter(
            models.TimeSlot.slot_date >= start_date,
            models.TimeSlot.slot_date <= end_date,
            models.Booking.status != "cancelled"
        )
    )

    if transport_type_id is not None:
        subquery = subquery.filter(models.Booking.transport_type_id == transport_type_id)
    if supplier_id is not None:
        subquery = subquery.filter(models.Booking.supplier_id == supplier_id)
    if object_id is not None:
        subquery = subquery.filter(models.Dock.object_id == object_id)
    if dock_type is not None:
        try:
            dock_type_enum = models.DockType(dock_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dock_type")
        subquery = subquery.filter(models.Dock.dock_type == dock_type_enum)

    subquery = subquery.distinct().subquery()

    # Main query to aggregate results by zone
    query = (
        db.query(
            models.Zone.name.label("zone_name"),
            func.count(models.Booking.id).label("booking_count"),
            func.coalesce(func.sum(models.Booking.cubes), 0).label("cubes_sum")
        )
        .join(subquery, subquery.c.booking_id == models.Booking.id)
        .join(models.Zone, models.Booking.zone_id == models.Zone.id)
        .group_by(models.Zone.name)
        .order_by(func.count(models.Booking.id).desc())
    )

    results = []
    for row in query.all():
        results.append({
            "zone_name": row.zone_name,
            "booking_count": row.booking_count,
            "cubes_sum": float(row.cubes_sum) if row.cubes_sum is not None else 0.0
        })

    return results
