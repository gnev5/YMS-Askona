from datetime import date, time, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..db import get_db
from .. import models
from ..models_new import TimeSlot, BookingTimeSlot, Booking as NewBooking
from ..deps import require_admin

router = APIRouter()


@router.get("/journal")
def get_time_slots_journal(
    start_date: Optional[date] = Query(None, description="Начальная дата фильтрации"),
    end_date: Optional[date] = Query(None, description="Конечная дата фильтрации"),
    dock_id: Optional[int] = Query(None, description="ID дока для фильтрации"),
    is_available: Optional[bool] = Query(None, description="Фильтр по доступности"),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Журнал временных слотов с возможностью фильтрации"""
    query = db.query(TimeSlot)
    
    if start_date:
        query = query.filter(TimeSlot.slot_date >= start_date)
    if end_date:
        query = query.filter(TimeSlot.slot_date <= end_date)
    if dock_id:
        query = query.filter(TimeSlot.dock_id == dock_id)
    if is_available is not None:
        query = query.filter(TimeSlot.is_available == is_available)
    
    slots = query.order_by(TimeSlot.slot_date, TimeSlot.start_time).all()
    
    # Подсчитываем занятость для каждого слота
    result = []
    for slot in slots:
        # Подсчитываем количество записей на этот слот
        occupancy = db.query(func.count(BookingTimeSlot.id)).filter(
            BookingTimeSlot.time_slot_id == slot.id
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
                    existing = db.query(TimeSlot).filter(
                        TimeSlot.dock_id == schedule.dock_id,
                        TimeSlot.slot_date == current_date,
                        TimeSlot.start_time == current_time,
                        TimeSlot.end_time == next_time
                    ).first()
                    
                    if not existing:
                        new_slot = TimeSlot(
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
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    
    # Проверяем, нет ли активных записей на этот слот
    if not is_available:
        active_bookings = db.query(BookingTimeSlot).join(NewBooking).filter(
            BookingTimeSlot.time_slot_id == slot_id,
            NewBooking.status == "confirmed"
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
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    
    # Проверяем, нет ли записей на этот слот
    bookings_count = db.query(BookingTimeSlot).filter(
        BookingTimeSlot.time_slot_id == slot_id
    ).count()
    
    if bookings_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete slot with {bookings_count} bookings"
        )
    
    db.delete(slot)
    db.commit()
    
    return {"message": "Time slot deleted successfully"}


@router.get("/calendar")
def get_calendar_slots(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """Получить слоты для календаря (аналог старого endpoint)"""
    slots = db.query(TimeSlot).filter(
        TimeSlot.slot_date >= start_date,
        TimeSlot.slot_date <= end_date,
        TimeSlot.is_available == True
    ).all()
    
    # Подсчитываем занятость
    result = []
    for slot in slots:
        occupancy = db.query(func.count(BookingTimeSlot.id)).filter(
            BookingTimeSlot.time_slot_id == slot.id
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
            "status": status
        })
    
    return result
