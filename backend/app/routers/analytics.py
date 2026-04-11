from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import date, datetime, timedelta
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
    supplier_ids: list[int] | None = Query(default=None),
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
    if supplier_ids:
        subquery = subquery.filter(models.Booking.supplier_id.in_(supplier_ids))
    elif supplier_id is not None:
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
    supplier_ids: list[int] | None = Query(default=None),
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
    if supplier_ids:
        subquery = subquery.filter(models.Booking.supplier_id.in_(supplier_ids))
    elif supplier_id is not None:
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


@router.get("/bookings-by-hour")
def get_bookings_by_hour(
    start_date: date,
    end_date: date,
    transport_type_id: int = None,
    supplier_id: int = None,
    supplier_ids: list[int] | None = Query(default=None),
    object_id: int = None,
    dock_type: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Почасовая статистика:
    1) по часу начала записи;
    2) по всем часам, которые занимает запись (объем делится равномерно по этим часам).
    """
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    query = (
        db.query(
            models.Booking.id.label("booking_id"),
            models.Booking.cubes.label("cubes"),
            models.TimeSlot.slot_date.label("slot_date"),
            models.TimeSlot.start_time.label("start_time"),
            models.TimeSlot.end_time.label("end_time"),
        )
        .join(models.BookingTimeSlot, models.BookingTimeSlot.booking_id == models.Booking.id)
        .join(models.TimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id)
        .join(models.Dock, models.Dock.id == models.TimeSlot.dock_id)
        .filter(
            models.TimeSlot.slot_date >= start_date,
            models.TimeSlot.slot_date <= end_date,
            models.Booking.status != "cancelled",
        )
    )

    if transport_type_id is not None:
        query = query.filter(models.Booking.transport_type_id == transport_type_id)
    if supplier_ids:
        query = query.filter(models.Booking.supplier_id.in_(supplier_ids))
    elif supplier_id is not None:
        query = query.filter(models.Booking.supplier_id == supplier_id)
    if object_id is not None:
        query = query.filter(models.Dock.object_id == object_id)
    if dock_type is not None:
        try:
            dock_type_enum = models.DockType(dock_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dock_type")
        query = query.filter(models.Dock.dock_type == dock_type_enum)

    rows = query.all()

    def get_slot_occupied_hours(slot_start: datetime, slot_end: datetime) -> set[int]:
        occupied_hours: set[int] = set()
        cursor = slot_start.replace(minute=0, second=0, microsecond=0)
        while cursor < slot_end:
            next_hour = cursor + timedelta(hours=1)
            if next_hour > slot_start and cursor < slot_end:
                occupied_hours.add(cursor.hour)
            cursor = next_hour

        if not occupied_hours:
            occupied_hours.add(slot_start.hour)

        return occupied_hours

    bookings_agg: dict[int, dict[str, datetime | float | set[int]]] = {}
    for row in rows:
        slot_start = datetime.combine(row.slot_date, row.start_time)
        slot_end = datetime.combine(row.slot_date, row.end_time)
        cubes = float(row.cubes) if row.cubes is not None else 0.0
        slot_occupied_hours = get_slot_occupied_hours(slot_start, slot_end)

        if row.booking_id not in bookings_agg:
            bookings_agg[row.booking_id] = {
                "start": slot_start,
                "cubes": cubes,
                "occupied_hours": set(slot_occupied_hours),
            }
            continue

        current = bookings_agg[row.booking_id]
        if slot_start < current["start"]:
            current["start"] = slot_start
        current["occupied_hours"].update(slot_occupied_hours)

    start_count_by_hour = [0] * 24
    start_cubes_by_hour = [0.0] * 24
    occupied_count_by_hour = [0] * 24
    occupied_cubes_by_hour = [0.0] * 24

    for item in bookings_agg.values():
        start_dt = item["start"]
        cubes = float(item["cubes"])

        start_hour = start_dt.hour
        start_count_by_hour[start_hour] += 1
        start_cubes_by_hour[start_hour] += cubes

        occupied_hours = sorted(item["occupied_hours"]) or [start_hour]

        cubes_per_hour = cubes / len(occupied_hours) if occupied_hours else 0.0
        for hour in occupied_hours:
            occupied_count_by_hour[hour] += 1
            occupied_cubes_by_hour[hour] += cubes_per_hour

    result = []
    for hour in range(24):
        result.append({
            "hour": hour,
            "label": f"{hour:02d}:00",
            "start_count": start_count_by_hour[hour],
            "start_cubes": start_cubes_by_hour[hour],
            "occupied_count": occupied_count_by_hour[hour],
            "occupied_cubes": occupied_cubes_by_hour[hour],
        })

    return result
