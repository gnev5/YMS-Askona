from datetime import time, datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from .. import models, schemas
from ..deps import require_admin

router = APIRouter()


@router.get("/", response_model=List[schemas.WorkSchedule])
def list_schedules(db: Session = Depends(get_db)):
    schedules = db.query(models.WorkSchedule).order_by(models.WorkSchedule.day_of_week).all()
    # Convert time objects to strings for response
    result = []
    for schedule in schedules:
        result.append({
            "id": schedule.id,
            "day_of_week": schedule.day_of_week,
            "dock_id": schedule.dock_id,
            "work_start": schedule.work_start.strftime("%H:%M") if schedule.work_start else None,
            "work_end": schedule.work_end.strftime("%H:%M") if schedule.work_end else None,
            "break_start": schedule.break_start.strftime("%H:%M") if schedule.break_start else None,
            "break_end": schedule.break_end.strftime("%H:%M") if schedule.break_end else None,
            "capacity": schedule.capacity,
            "is_working_day": schedule.is_working_day,
        })
    return result


@router.post("/", response_model=schemas.WorkSchedule, status_code=status.HTTP_201_CREATED)
def create_schedule(payload: schemas.WorkScheduleCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    exists = db.query(models.WorkSchedule).filter(
        models.WorkSchedule.day_of_week == payload.day_of_week,
        models.WorkSchedule.dock_id == payload.dock_id
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Schedule for this day and dock already exists")
    
    # Convert string times to time objects
    work_start = datetime.strptime(payload.work_start, "%H:%M").time() if payload.work_start else None
    work_end = datetime.strptime(payload.work_end, "%H:%M").time() if payload.work_end else None
    break_start = datetime.strptime(payload.break_start, "%H:%M").time() if payload.break_start else None
    break_end = datetime.strptime(payload.break_end, "%H:%M").time() if payload.break_end else None
    
    ws = models.WorkSchedule(
        day_of_week=payload.day_of_week,
        work_start=work_start,
        work_end=work_end,
        break_start=break_start,
        break_end=break_end,
        capacity=payload.capacity,
        is_working_day=payload.is_working_day,
        dock_id=payload.dock_id
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    
    # Convert back to string format for response
    return {
        "id": ws.id,
        "day_of_week": ws.day_of_week,
        "dock_id": ws.dock_id,
        "work_start": ws.work_start.strftime("%H:%M") if ws.work_start else None,
        "work_end": ws.work_end.strftime("%H:%M") if ws.work_end else None,
        "break_start": ws.break_start.strftime("%H:%M") if ws.break_start else None,
        "break_end": ws.break_end.strftime("%H:%M") if ws.break_end else None,
        "capacity": ws.capacity,
        "is_working_day": ws.is_working_day,
    }


@router.put("/{schedule_id}", response_model=schemas.WorkSchedule)
def update_schedule(schedule_id: int, payload: schemas.WorkScheduleCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    ws = db.query(models.WorkSchedule).get(schedule_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Convert string times to time objects
    work_start = datetime.strptime(payload.work_start, "%H:%M").time() if payload.work_start else None
    work_end = datetime.strptime(payload.work_end, "%H:%M").time() if payload.work_end else None
    break_start = datetime.strptime(payload.break_start, "%H:%M").time() if payload.break_start else None
    break_end = datetime.strptime(payload.break_end, "%H:%M").time() if payload.break_end else None
    
    ws.day_of_week = payload.day_of_week
    ws.work_start = work_start
    ws.work_end = work_end
    ws.break_start = break_start
    ws.break_end = break_end
    ws.capacity = payload.capacity
    ws.is_working_day = payload.is_working_day
    ws.dock_id = payload.dock_id

    db.commit()
    db.refresh(ws)
    
    # Convert back to string format for response
    return {
        "id": ws.id,
        "day_of_week": ws.day_of_week,
        "dock_id": ws.dock_id,
        "work_start": ws.work_start.strftime("%H:%M") if ws.work_start else None,
        "work_end": ws.work_end.strftime("%H:%M") if ws.work_end else None,
        "break_start": ws.break_start.strftime("%H:%M") if ws.break_start else None,
        "break_end": ws.break_end.strftime("%H:%M") if ws.break_end else None,
        "capacity": ws.capacity,
        "is_working_day": ws.is_working_day,
    }


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    ws = db.query(models.WorkSchedule).get(schedule_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(ws)
    db.commit()
    return None


@router.post("/generate-time-slots", status_code=status.HTTP_201_CREATED)
def generate_time_slots(
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db), 
    _: models.User = Depends(require_admin)
):
    """Генерация временных слотов на указанный период (обновленная версия)"""
    # Если даты не указаны, генерируем на 4 недели со следующей недели
    if not start_date:
        # Находим следующий понедельник
        today = date.today()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:  # Если сегодня понедельник, берем следующий
            days_until_monday = 7
        start_date = today + timedelta(days=days_until_monday)
    if not end_date:
        end_date = start_date + timedelta(weeks=4)
    
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
