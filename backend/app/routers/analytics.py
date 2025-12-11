from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, cast, Date
from typing import List
from datetime import datetime, date
from .. import models, schemas
from ..db import get_db
from ..deps import get_current_user

router = APIRouter()


@router.get("/bookings-by-day")
def get_bookings_by_day(
    start_date: date,
    end_date: date,
    transport_type_id: int = None,
    supplier_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получение статистики по количеству записей и кубов по дням"""
    # Проверяем, что пользователь имеет права администратора
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Получаем данные о бронированиях по дням
    query = (
        db.query(
            cast(models.TimeSlot.slot_date, Date).label("date"),
            func.count(models.Booking.id).label("count"),
            func.coalesce(func.sum(models.Booking.cubes), 0).label("cubes")
        )
        .join(models.BookingTimeSlot, models.BookingTimeSlot.booking_id == models.Booking.id)
        .join(models.TimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id)
        .filter(
            models.TimeSlot.slot_date >= start_date,
            models.TimeSlot.slot_date <= end_date,
            models.Booking.status != "cancelled"
        )
    )
    
    # Добавляем фильтр по типу перевозки, если указан
    if transport_type_id is not None:
        query = query.filter(models.Booking.transport_type_id == transport_type_id)
    
    # Добавляем фильтр по поставщику, если указан
    if supplier_id is not None:
        query = query.filter(models.Booking.supplier_id == supplier_id)
        
    # Группировка и сортировка
    query = query.group_by(cast(models.TimeSlot.slot_date, Date)).order_by(cast(models.TimeSlot.slot_date, Date))

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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получение статистики по количеству записей и кубов по зонам"""
    # Проверяем, что пользователь имеет права администратора
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Получаем данные о бронированиях по зонам
    query = (
        db.query(
            models.Zone.name.label("zone_name"),
            func.count(models.Booking.id).label("booking_count"),
            func.coalesce(func.sum(models.Booking.cubes), 0).label("cubes_sum")
        )
        .join(models.Booking, models.Booking.zone_id == models.Zone.id)
        .join(models.BookingTimeSlot, models.BookingTimeSlot.booking_id == models.Booking.id)
        .join(models.TimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id)
        .filter(
            models.TimeSlot.slot_date >= start_date,
            models.TimeSlot.slot_date <= end_date,
            models.Booking.status != "cancelled"
        )
    )
    
    # Добавляем фильтр по типу перевозки, если указан
    if transport_type_id is not None:
        query = query.filter(models.Booking.transport_type_id == transport_type_id)
    
    # Добавляем фильтр по поставщику, если указан
    if supplier_id is not None:
        query = query.filter(models.Booking.supplier_id == supplier_id)
        
    # Группировка и сортировка
    query = query.group_by(models.Zone.name).order_by(func.count(models.Booking.id).desc())

    results = []
    for row in query.all():
        results.append({
            "zone_name": row.zone_name,
            "booking_count": row.booking_count,
            "cubes_sum": float(row.cubes_sum) if row.cubes_sum is not None else 0.0
        })

    return results