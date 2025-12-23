from datetime import date, time, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..db import get_db
from .. import models, schemas
from ..deps import require_admin

router = APIRouter()


@router.get("/", response_model=List[schemas.TimeSlotWithOccupancy])
def list_time_slots(
    from_date: date,
    to_date: date,
    object_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    transport_type_id: Optional[int] = None,
    booking_type: Optional[str] = None, # "in" or "out"
    db: Session = Depends(get_db),
):
    """Получить слоты для календаря (обновленная версия)"""
    
    # Start with a query for all docks
    docks_query = db.query(models.Dock.id)

    if object_id:
        docks_query = docks_query.filter(models.Dock.object_id == object_id)

    if booking_type == "in":
        docks_query = docks_query.filter(models.Dock.dock_type.in_([models.DockType.entrance, models.DockType.universal]))
    elif booking_type == "out":
        docks_query = docks_query.filter(models.Dock.dock_type.in_([models.DockType.exit, models.DockType.universal]))

    if supplier_id:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if supplier and supplier.zone_id:
            # Docks that have no specific zones or are in the supplier's zone
            docks_query = docks_query.filter(
                or_(
                    ~models.Dock.available_zones.any(),
                    models.Dock.available_zones.any(models.Zone.id == supplier.zone_id)
                )
            )

    if transport_type_id:
        # Docks that have no specific transport types or have the given transport type
        docks_query = docks_query.filter(
            or_(
                ~models.Dock.available_transport_types.any(),
                models.Dock.available_transport_types.any(models.TransportTypeRef.id == transport_type_id)
            )
        )

    dock_ids = [d[0] for d in docks_query.all()]

    if not dock_ids:
        return []

    slots = db.query(models.TimeSlot).filter(
        models.TimeSlot.slot_date >= from_date,
        models.TimeSlot.slot_date <= to_date,
        models.TimeSlot.is_available == True,
        models.TimeSlot.dock_id.in_(dock_ids)
    ).all()
    
    # Подсчитываем занятость
    result = []
    for slot in slots:
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
        
        result.append(
            schemas.TimeSlotWithOccupancy(
                id=slot.id,
                day_of_week=slot.slot_date.weekday(),
                start_time=slot.start_time.strftime("%H:%M"),
                end_time=slot.end_time.strftime("%H:%M"),
                capacity=slot.capacity,
                dock_id=slot.dock_id,
                occupancy=occupancy,
                status=status,
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
