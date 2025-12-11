from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from ..db import get_db
from .. import models
from ..models_new import Booking, BookingTimeSlot, TimeSlot
from ..deps import get_current_user

router = APIRouter()


@router.post("/", response_model=dict)
def create_booking(
    booking_data: dict,  # Временно dict, потом создадим схему
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Создание новой записи на ПРР"""
    # Валидация типа транспорта
    vehicle_type = db.query(models.VehicleType).filter(
        models.VehicleType.id == booking_data["vehicle_type_id"]
    ).first()
    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    
    # Вычисляем требуемое количество слотов
    required_slots = vehicle_type.duration_minutes // 30 + (1 if vehicle_type.duration_minutes % 30 != 0 else 0)
    
    # Парсим дату и время начала
    booking_date = datetime.strptime(booking_data["booking_date"], "%Y-%m-%d").date()
    start_time = datetime.strptime(booking_data["start_time"], "%H:%M").time()
    
    # Находим доступные слоты
    available_slots = db.query(TimeSlot).filter(
        TimeSlot.slot_date == booking_date,
        TimeSlot.start_time >= start_time,
        TimeSlot.is_available == True
    ).order_by(TimeSlot.start_time).all()
    
    # Группируем слоты по докам
    slots_by_dock = {}
    for slot in available_slots:
        if slot.dock_id not in slots_by_dock:
            slots_by_dock[slot.dock_id] = []
        slots_by_dock[slot.dock_id].append(slot)
    
    # Ищем подходящую цепочку слотов
    chosen_slots = None
    for dock_id, dock_slots in slots_by_dock.items():
        # Сортируем слоты по времени
        dock_slots.sort(key=lambda x: x.start_time)
        
        # Ищем непрерывную цепочку нужной длины
        for i in range(len(dock_slots) - required_slots + 1):
            chain = dock_slots[i:i + required_slots]
            
            # Проверяем, что слоты идут подряд
            is_continuous = True
            for j in range(len(chain) - 1):
                current_end = chain[j].end_time
                next_start = chain[j + 1].start_time
                if current_end != next_start:
                    is_continuous = False
                    break
            
            if not is_continuous:
                continue
            
            # Проверяем доступность всех слотов в цепочке
            all_available = True
            for slot in chain:
                # Подсчитываем текущую занятость
                current_occupancy = db.query(func.count(BookingTimeSlot.id)).filter(
                    BookingTimeSlot.time_slot_id == slot.id
                ).scalar() or 0
                
                if current_occupancy >= slot.capacity:
                    all_available = False
                    break
            
            if all_available:
                chosen_slots = chain
                break
        
        if chosen_slots:
            break
    
    if not chosen_slots:
        raise HTTPException(
            status_code=409, 
            detail="No available time slots found for the requested period"
        )
    
    # Создаем запись
    new_booking = Booking(
        user_id=current_user.id,
        vehicle_type_id=booking_data["vehicle_type_id"],
        vehicle_plate=booking_data["vehicle_plate"],
        driver_full_name=booking_data["driver_full_name"],
        driver_phone=booking_data["driver_phone"],
        status="confirmed"
    )
    db.add(new_booking)
    db.flush()  # Получаем ID
    
    # Создаем связи с временными слотами
    for slot in chosen_slots:
        booking_slot = BookingTimeSlot(
            booking_id=new_booking.id,
            time_slot_id=slot.id
        )
        db.add(booking_slot)
    
    db.commit()
    db.refresh(new_booking)
    
    return {
        "id": new_booking.id,
        "status": new_booking.status,
        "vehicle_plate": new_booking.vehicle_plate,
        "driver_full_name": new_booking.driver_full_name,
        "driver_phone": new_booking.driver_phone,
        "slots_count": len(chosen_slots),
        "created_at": new_booking.created_at.isoformat()
    }


@router.get("/my", response_model=List[dict])
def get_my_bookings(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Получить мои записи"""
    bookings = db.query(Booking).filter(
        Booking.user_id == current_user.id,
        Booking.status == "confirmed"
    ).order_by(Booking.created_at.desc()).all()
    
    result = []
    for booking in bookings:
        # Получаем слоты для этой записи
        slots = db.query(TimeSlot, BookingTimeSlot).join(
            BookingTimeSlot, TimeSlot.id == BookingTimeSlot.time_slot_id
        ).filter(BookingTimeSlot.booking_id == booking.id).all()
        
        if slots:
            first_slot = slots[0][0]  # TimeSlot
            last_slot = slots[-1][0]  # TimeSlot
            
            result.append({
                "id": booking.id,
                "vehicle_plate": booking.vehicle_plate,
                "driver_full_name": booking.driver_full_name,
                "driver_phone": booking.driver_phone,
                "status": booking.status,
                "booking_date": first_slot.slot_date.isoformat(),
                "start_time": first_slot.start_time.strftime("%H:%M"),
                "end_time": last_slot.end_time.strftime("%H:%M"),
                "slots_count": len(slots),
                "created_at": booking.created_at.isoformat()
            })
    
    return result


@router.get("/{booking_id}/slots")
def get_booking_slots(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить слоты конкретной записи"""
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    slots = db.query(TimeSlot, models.Dock).join(
        BookingTimeSlot, TimeSlot.id == BookingTimeSlot.time_slot_id
    ).join(
        models.Dock, TimeSlot.dock_id == models.Dock.id
    ).filter(BookingTimeSlot.booking_id == booking_id).all()
    
    result = []
    for slot, dock in slots:
        result.append({
            "id": slot.id,
            "dock_name": dock.name,
            "slot_date": slot.slot_date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "capacity": slot.capacity
        })
    
    return result


@router.put("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Отменить запись"""
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail="Booking is not in confirmed status")
    
    booking.status = "cancelled"
    booking.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Booking cancelled successfully"}


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить запись (только если она отменена)"""
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status == "confirmed":
        raise HTTPException(status_code=400, detail="Cannot delete confirmed booking. Cancel it first.")
    
    # Удаляем связи с слотами
    db.query(BookingTimeSlot).filter(BookingTimeSlot.booking_id == booking_id).delete()
    
    # Удаляем запись
    db.delete(booking)
    db.commit()
    
    return {"message": "Booking deleted successfully"}
