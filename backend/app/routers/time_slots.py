from datetime import date, time, datetime, timedelta
from datetime import date, time, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..db import get_db
from .. import models, schemas
from ..deps import require_admin

router = APIRouter()


@router.get("/", response_model=List[schemas.TimeSlotWithBookings])
def list_time_slots(
    from_date: date,
    to_date: date,
    object_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    transport_type_id: Optional[int] = None,
    booking_type: Optional[str] = Query(None, description="in|out to auto-filter dock types"),
    dock_types: Optional[str] = Query(None, description="Comma-separated list of dock types (e.g., 'exit,universal')"),
    db: Session = Depends(get_db),
):
    """Получить список свободных временных слотов (календарь бронирований)"""

    docks_query = db.query(models.Dock.id)

    if object_id:
        docks_query = docks_query.filter(models.Dock.object_id == object_id)

    inferred_types: list[models.DockType] | None = None
    if booking_type:
        try:
            direction = models.BookingDirection(booking_type)
        except Exception:
            raise HTTPException(status_code=400, detail="booking_type must be 'in' or 'out'")
        if direction == models.BookingDirection.inbound:
            inferred_types = [models.DockType.entrance, models.DockType.universal]
        else:
            inferred_types = [models.DockType.exit, models.DockType.universal]

    types: list[models.DockType] | None = None
    if dock_types:
        try:
            provided = [models.DockType(t.strip()) for t in dock_types.split(',') if t.strip()]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid dock_type provided: {e}")
        if inferred_types and any(t not in inferred_types for t in provided):
            raise HTTPException(status_code=400, detail="dock_types do not match booking_type")
        types = provided
    elif inferred_types:
        types = inferred_types

    if types:
        docks_query = docks_query.filter(models.Dock.dock_type.in_(types))

    if supplier_id:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if supplier and supplier.zone_id:
            docks_query = docks_query.filter(
                or_(
                    ~models.Dock.available_zones.any(),
                    models.Dock.available_zones.any(models.Zone.id == supplier.zone_id)
                )
            )

    if transport_type_id:
        docks_query = docks_query.filter(
            or_(
                ~models.Dock.available_transport_types.any(),
                models.Dock.available_transport_types.any(models.TransportTypeRef.id == transport_type_id)
            )
        )

    dock_ids = [d[0] for d in docks_query.all()]

    # Fallback: If no docks match the specific transport type, show all docks for the given object and dock types
    if not dock_ids and transport_type_id:
        fallback_query = db.query(models.Dock.id)
        if object_id:
            fallback_query = fallback_query.filter(models.Dock.object_id == object_id)
        if types:
            fallback_query = fallback_query.filter(models.Dock.dock_type.in_(types))

        dock_ids = [d[0] for d in fallback_query.all()]

    if not dock_ids:
        return []

    slots = db.query(models.TimeSlot).filter(
        models.TimeSlot.slot_date >= from_date,
        models.TimeSlot.slot_date <= to_date,
        models.TimeSlot.is_available == True,
        models.TimeSlot.dock_id.in_(dock_ids)
    ).all()

    if not slots:
        return []

    slot_ids = [slot.id for slot in slots]

    occupancy_rows = (
        db.query(models.BookingTimeSlot.time_slot_id, func.count(models.BookingTimeSlot.id))
        .filter(models.BookingTimeSlot.time_slot_id.in_(slot_ids))
        .group_by(models.BookingTimeSlot.time_slot_id)
        .all()
    )
    occupancy_map = {row[0]: row[1] for row in occupancy_rows}

    booking_rows = (
        db.query(
            models.BookingTimeSlot.time_slot_id,
            models.Booking.id.label("booking_id"),
            models.Supplier.name.label("supplier_name"),
            models.Booking.cubes.label("cubes"),
            models.Booking.transport_sheet.label("transport_sheet"),
            models.User.full_name.label("user_full_name"),
            models.User.email.label("user_email"),
        )
        .join(models.Booking, models.Booking.id == models.BookingTimeSlot.booking_id)
        .outerjoin(models.Supplier, models.Supplier.id == models.Booking.supplier_id)
        .outerjoin(models.User, models.User.id == models.Booking.user_id)
        .filter(models.BookingTimeSlot.time_slot_id.in_(slot_ids))
        .filter(models.Booking.status == "confirmed")
        .all()
    )

    slot_by_id = {slot.id: slot for slot in slots}

    # Track first slot per booking to mark start
    first_slot_by_booking: dict[int, int] = {}
    for row in booking_rows:
        slot = slot_by_id.get(row.time_slot_id)
        if not slot:
            continue
        current_start = datetime.combine(slot.slot_date, slot.start_time)
        if row.booking_id not in first_slot_by_booking:
            first_slot_by_booking[row.booking_id] = (current_start, row.time_slot_id)
        else:
            existing_dt, _ = first_slot_by_booking[row.booking_id]
            if current_start < existing_dt:
                first_slot_by_booking[row.booking_id] = (current_start, row.time_slot_id)

    bookings_map: dict[int, list[schemas.TimeSlotBookingInfo]] = {}
    for row in booking_rows:
        is_start = False
        first_entry = first_slot_by_booking.get(row.booking_id)
        if first_entry and first_entry[1] == row.time_slot_id:
            is_start = True

        bookings_map.setdefault(row.time_slot_id, []).append(
            schemas.TimeSlotBookingInfo(
                id=row.booking_id,
                supplier_name=row.supplier_name,
                cubes=row.cubes,
                transport_sheet=row.transport_sheet,
                user_full_name=row.user_full_name,
                user_email=row.user_email,
                is_start=is_start,
            )
        )

    result = []
    for slot in slots:
        occupancy = occupancy_map.get(slot.id, 0)
        
        status = "free"
        if occupancy == 0:
            status = "free"
        elif occupancy < slot.capacity:
            status = "partial"
        else:
            status = "full"
        
        result.append(
            schemas.TimeSlotWithBookings(
                id=slot.id,
                day_of_week=slot.slot_date.weekday(),
                start_time=slot.start_time.strftime("%H:%M"),
                end_time=slot.end_time.strftime("%H:%M"),
                capacity=slot.capacity,
                dock_id=slot.dock_id,
                occupancy=occupancy,
                status=status,
                bookings=bookings_map.get(slot.id, [])
            )
        )

    return result

@router.get("/journal")
def get_time_slots_journal(
    start_date: Optional[date] = Query(None, description="Начальная дата фильтрации"),
    end_date: Optional[date] = Query(None, description="Конечная дата фильтрации"),
    dock_id: Optional[int] = Query(None, description="ID дока для фильтрации"),
    is_available: Optional[bool] = Query(None, description="Фильтр по доступности"),
    object_id: Optional[int] = Query(None, description="ID объекта"),
    dock_type: Optional[str] = Query(None, description="Тип дока: entrance/exit/universal"),
    start_time_from: Optional[time] = Query(None, description="Время начала слота с (HH:MM)"),
    start_time_to: Optional[time] = Query(None, description="Время начала слота по (HH:MM)"),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Журнал временных слотов с возможностью фильтрации"""
    query = db.query(models.TimeSlot).join(models.Dock)
    
    if start_date:
        query = query.filter(models.TimeSlot.slot_date >= start_date)
    if end_date:
        query = query.filter(models.TimeSlot.slot_date <= end_date)
    if dock_id:
        query = query.filter(models.TimeSlot.dock_id == dock_id)
    if is_available is not None:
        query = query.filter(models.TimeSlot.is_available == is_available)
    if object_id:
        query = query.filter(models.Dock.object_id == object_id)
    if dock_type:
        try:
            dock_type_enum = models.DockType(dock_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dock_type")
        query = query.filter(models.Dock.dock_type == dock_type_enum)
    if start_time_from and start_time_to and start_time_from > start_time_to:
        raise HTTPException(status_code=400, detail="start_time_from must be before start_time_to")
    if start_time_from and start_time_to:
        query = query.filter(
            and_(
                models.TimeSlot.start_time < start_time_to,
                models.TimeSlot.end_time > start_time_from
            )
        )
    elif start_time_from:
        query = query.filter(models.TimeSlot.end_time > start_time_from)
    elif start_time_to:
        query = query.filter(models.TimeSlot.start_time < start_time_to)
    
    slots = query.order_by(models.TimeSlot.slot_date, models.TimeSlot.start_time).all()
    
    # Подсчитываем занятость для каждого слота
    result = []
    for slot in slots:
        # Подсчитываем количество записей на этот слот
        occupancy = db.query(func.count(models.BookingTimeSlot.id)).filter(
            models.BookingTimeSlot.time_slot_id == slot.id
        ).scalar() or 0
        
        status = "free"
        if occupancy == 0:
            status = "free"
        elif occupancy < slot.capacity:
            status = "partial"
        else:
            status = "full"
        
        result.append({
            "id": slot.id,
            "dock_id": slot.dock_id,
            "slot_date": slot.slot_date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "capacity": slot.capacity,
            "occupancy": occupancy,
            "status": status,
            "is_available": slot.is_available,
            "created_at": slot.created_at.isoformat(),
            "updated_at": slot.updated_at.isoformat()
        })
    
    return result


@router.post("/generate")
def generate_time_slots(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Генерация временных слотов на указанный период"""
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    if (end_date - start_date).days > 90:  # Ограничиваем 3 месяцами
        raise HTTPException(status_code=400, detail="Period cannot exceed 90 days")
    
    schedules = db.query(models.WorkSchedule).all()
    slots_created = 0
    
    current_date = start_date
    while current_date <= end_date:
        weekday = current_date.weekday()
        
        for schedule in schedules:
            if (schedule.day_of_week == weekday and 
                schedule.is_working_day and 
                schedule.work_start and 
                schedule.work_end):
                
                current_time = schedule.work_start
                while current_time < schedule.work_end:
                    next_time = (datetime.combine(current_date, current_time) + timedelta(minutes=30)).time()
                    
                    # Пропускаем слоты, пересекающиеся с перерывом
                    if (schedule.break_start and schedule.break_end and 
                        current_time < schedule.break_end and next_time > schedule.break_start):
                        current_time = schedule.break_end
                        continue
                    
                    # Проверяем, не существует ли уже такой слот
                    existing = db.query(models.TimeSlot).filter(
                        models.TimeSlot.dock_id == schedule.dock_id,
                        models.TimeSlot.slot_date == current_date,
                        models.TimeSlot.start_time == current_time,
                        models.TimeSlot.end_time == next_time
                    ).first()
                    
                    if not existing:
                        new_slot = models.TimeSlot(
                            dock_id=schedule.dock_id,
                            slot_date=current_date,
                            start_time=current_time,
                            end_time=next_time,
                            capacity=schedule.capacity,
                            is_available=True
                        )
                        db.add(new_slot)
                        slots_created += 1
                    
                    current_time = next_time
        
        current_date += timedelta(days=1)
    
    db.commit()
    return {"message": f"Generated {slots_created} time slots", "slots_created": slots_created}


@router.put("/{slot_id}/availability")
def toggle_slot_availability(
    slot_id: int,
    is_available: bool,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Включить/отключить доступность слота"""
    slot = db.query(models.TimeSlot).filter(models.TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    
    # Проверяем, нет ли активных записей на этот слот
    if not is_available:
        active_bookings = db.query(models.BookingTimeSlot).join(models.Booking).filter(
            models.BookingTimeSlot.time_slot_id == slot_id,
            models.Booking.status == "confirmed"
        ).count()
        
        if active_bookings > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot disable slot with {active_bookings} active bookings"
            )
    
    slot.is_available = is_available
    slot.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": f"Slot availability set to {is_available}"}


@router.delete("/{slot_id}")
def delete_time_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Удалить конкретный временной слот"""
    slot = db.query(models.TimeSlot).filter(models.TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    
    # Проверяем, нет ли записей на этот слот
    bookings_count = db.query(models.BookingTimeSlot).filter(
        models.BookingTimeSlot.time_slot_id == slot_id
    ).count()
    
    if bookings_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete slot with {bookings_count} bookings"
        )
    
    db.delete(slot)
    db.commit()
    
    return {"message": "Time slot deleted successfully"}


@router.post("/bulk-delete")
def bulk_delete_time_slots(
    slot_ids: List[int],
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Массовое удаление временных слотов"""
    if not slot_ids:
        raise HTTPException(status_code=400, detail="No slot IDs provided")
    
    # Проверяем существование всех слотов
    existing_slots = db.query(models.TimeSlot).filter(
        models.TimeSlot.id.in_(slot_ids)
    ).all()
    
    if len(existing_slots) != len(slot_ids):
        found_ids = [slot.id for slot in existing_slots]
        missing_ids = [sid for sid in slot_ids if sid not in found_ids]
        raise HTTPException(
            status_code=404, 
            detail=f"Time slots not found: {missing_ids}"
        )
    
    # Проверяем, нет ли записей на эти слоты
    slots_with_bookings = []
    for slot in existing_slots:
        bookings_count = db.query(models.BookingTimeSlot).filter(
            models.BookingTimeSlot.time_slot_id == slot.id
        ).count()
        
        if bookings_count > 0:
            slots_with_bookings.append({
                "slot_id": slot.id,
                "bookings_count": bookings_count,
                "slot_info": f"{slot.slot_date} {slot.start_time}-{slot.end_time}"
            })
    
    if slots_with_bookings:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete slots with bookings: {slots_with_bookings}"
        )
    
    # Удаляем слоты
    deleted_count = db.query(models.TimeSlot).filter(
        models.TimeSlot.id.in_(slot_ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return {
        "message": f"Successfully deleted {deleted_count} time slots",
        "deleted_count": deleted_count
    }


@router.post("/")
def create_time_slot(
    slot_data: schemas.TimeSlotCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Создать новый временной слот"""
    # Проверяем, не существует ли уже такой слот
    existing = db.query(models.TimeSlot).filter(
        models.TimeSlot.dock_id == slot_data.dock_id,
        models.TimeSlot.slot_date == slot_data.slot_date,
        models.TimeSlot.start_time == slot_data.start_time,
        models.TimeSlot.end_time == slot_data.end_time
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Time slot with these parameters already exists"
        )
    
    new_slot = models.TimeSlot(
        dock_id=slot_data.dock_id,
        slot_date=slot_data.slot_date,
        start_time=slot_data.start_time,
        end_time=slot_data.end_time,
        capacity=slot_data.capacity,
        is_available=slot_data.is_available
    )
    
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    
    return {
        "message": "Time slot created successfully",
        "slot_id": new_slot.id
    }
