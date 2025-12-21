from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from datetime import datetime, timedelta
import uuid
from .. import models, schemas
from ..db import get_db
from ..deps import get_current_user
from .prr_limits import get_duration

router = APIRouter()

@router.post("/", response_model=schemas.Booking)
def create_booking(booking: schemas.BookingCreateUpdated, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Создание новой записи на ПРР (обновленная версия)"""
    # Валидация типа транспорта
    vehicle_type = db.query(models.VehicleType).filter(models.VehicleType.id == booking.vehicle_type_id).first()
    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    
    try:
        duration = get_duration(
            object_id=booking.object_id,
            supplier_id=booking.supplier_id,
            transport_type_id=booking.transport_type_id,
            vehicle_type_id=booking.vehicle_type_id,
            db=db
        ).duration_minutes
    except HTTPException as e:
        if e.status_code == 404:
            duration = vehicle_type.duration_minutes
        else:
            raise e

    if duration <= 0:
        raise HTTPException(status_code=400, detail="Invalid duration")
    
    # Вычисляем требуемое количество слотов
    required_slots = duration // 30 + (1 if duration % 30 != 0 else 0)
    
    # Парсим дату и время начала
    booking_date = datetime.strptime(booking.booking_date, "%Y-%m-%d").date()
    start_time = datetime.strptime(booking.start_time, "%H:%M").time()
    
    # Находим доступные слоты
    available_slots = db.query(models.TimeSlot).filter(
        models.TimeSlot.slot_date == booking_date,
        models.TimeSlot.start_time >= start_time,
        models.TimeSlot.is_available == True
    ).order_by(models.TimeSlot.start_time).all()
    
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
                current_occupancy = db.query(func.count(models.BookingTimeSlot.id)).filter(
                    models.BookingTimeSlot.time_slot_id == slot.id
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
    new_booking = models.Booking(
        user_id=current_user.id,
        vehicle_type_id=booking.vehicle_type_id,
        vehicle_plate=booking.vehicle_plate,
        driver_full_name=booking.driver_full_name,
        driver_phone=booking.driver_phone,
        status="confirmed",
        supplier_id=booking.supplier_id,
        zone_id=booking.zone_id,
        transport_type_id=booking.transport_type_id,
        cubes=booking.cubes,
        transport_sheet=booking.transport_sheet
    )
    db.add(new_booking)
    db.flush()  # Получаем ID
    
    # Создаем связи с временными слотами
    for slot in chosen_slots:
        booking_slot = models.BookingTimeSlot(
            booking_id=new_booking.id,
            time_slot_id=slot.id
        )
        db.add(booking_slot)
    
    db.commit()
    db.refresh(new_booking)
    return new_booking

@router.put("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Отменить запись"""
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail="Booking is not in confirmed status")
    
    booking.status = "cancelled"
    booking.updated_at = datetime.utcnow()
    
    # Удаляем связи с временными слотами, чтобы они снова стали доступны
    db.query(models.BookingTimeSlot).filter(
        models.BookingTimeSlot.booking_id == booking_id
    ).delete()
    
    db.commit()
    
    return {"message": "Booking cancelled successfully"}

@router.get("/all", response_model=List[schemas.BookingWithDetails])
def get_all_bookings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Получить все записи (только для администраторов)"""
    # Проверяем права администратора
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    bookings = db.query(models.Booking).filter(
        models.Booking.status == "confirmed"
    ).order_by(models.Booking.created_at.desc()).all()
    
    result = []
    for booking in bookings:
        # Получаем информацию о пользователе, создавшем запись
        user = db.query(models.User).filter(models.User.id == booking.user_id).first()
        
        # Получаем слоты для этой записи
        slots = db.query(models.TimeSlot, models.BookingTimeSlot).join(
            models.BookingTimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id
        ).filter(models.BookingTimeSlot.booking_id == booking.id).all()
        
        if slots:
            first_slot = slots[0][0]  # TimeSlot
            last_slot = slots[-1][0]  # TimeSlot
            
            # Получаем информацию о типе транспорта
            vehicle_type = db.query(models.VehicleType).filter(
                models.VehicleType.id == booking.vehicle_type_id
            ).first()
            
            # Получаем информацию о доке
            dock = db.query(models.Dock).filter(
                models.Dock.id == first_slot.dock_id
            ).first()
            
            # Получаем информацию о поставщике
            supplier = None
            if booking.supplier_id:
                supplier = db.query(models.Supplier).filter(
                    models.Supplier.id == booking.supplier_id
                ).first()
            
            # Получаем информацию о зоне
            zone = None
            if booking.zone_id:
                zone = db.query(models.Zone).filter(
                    models.Zone.id == booking.zone_id
                ).first()
            
            # Получаем информацию о типе перевозки
            transport_type = None
            if booking.transport_type_id:
                transport_type = db.query(models.TransportTypeRef).filter(
                    models.TransportTypeRef.id == booking.transport_type_id
                ).first()
            
            result.append({
                "id": booking.id,
                "booking_date": first_slot.slot_date.isoformat(),
                "start_time": first_slot.start_time.strftime("%H:%M"),
                "end_time": last_slot.end_time.strftime("%H:%M"),
                "vehicle_plate": booking.vehicle_plate,
                "driver_name": booking.driver_full_name,
                "driver_phone": booking.driver_phone,
                "vehicle_type_name": vehicle_type.name if vehicle_type else "Unknown",
                "dock_name": dock.name if dock else "Unknown",
                "status": booking.status,
                "slots_count": len(slots),
                "created_at": booking.created_at.isoformat(),
                "supplier_name": supplier.name if supplier else None,
                "zone_name": zone.name if zone else None,
                "transport_type_name": transport_type.name if transport_type else None,
                "cubes": booking.cubes,
                "transport_sheet": booking.transport_sheet,
                "user_email": user.email if user else "Unknown",
                "user_full_name": user.full_name if user else "Unknown"
            })
    
    return result

@router.get("/my", response_model=List[schemas.BookingWithDetails])
def get_my_bookings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Получить мои записи (обновленная версия)"""
    bookings = db.query(models.Booking).filter(
        models.Booking.user_id == current_user.id,
        models.Booking.status == "confirmed"
    ).order_by(models.Booking.created_at.desc()).all()
    
    result = []
    for booking in bookings:
        # Получаем слоты для этой записи
        slots = db.query(models.TimeSlot, models.BookingTimeSlot).join(
            models.BookingTimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id
        ).filter(models.BookingTimeSlot.booking_id == booking.id).all()
        
        if slots:
            first_slot = slots[0][0]  # TimeSlot
            last_slot = slots[-1][0]  # TimeSlot
            
            # Получаем информацию о типе транспорта
            vehicle_type = db.query(models.VehicleType).filter(
                models.VehicleType.id == booking.vehicle_type_id
            ).first()
            
            # Получаем информацию о доке
            dock = db.query(models.Dock).filter(
                models.Dock.id == first_slot.dock_id
            ).first()
            
            # Получаем информацию о поставщике
            supplier = None
            if booking.supplier_id:
                supplier = db.query(models.Supplier).filter(
                    models.Supplier.id == booking.supplier_id
                ).first()
            
            # Получаем информацию о зоне
            zone = None
            if booking.zone_id:
                zone = db.query(models.Zone).filter(
                    models.Zone.id == booking.zone_id
                ).first()
            
            # Получаем информацию о типе перевозки
            transport_type = None
            if booking.transport_type_id:
                transport_type = db.query(models.TransportTypeRef).filter(
                    models.TransportTypeRef.id == booking.transport_type_id
                ).first()
            
            result.append({
                "id": booking.id,
                "booking_date": first_slot.slot_date.isoformat(),
                "start_time": first_slot.start_time.strftime("%H:%M"),
                "end_time": last_slot.end_time.strftime("%H:%M"),
                "vehicle_plate": booking.vehicle_plate,
                "driver_name": booking.driver_full_name,
                "driver_phone": booking.driver_phone,
                "vehicle_type_name": vehicle_type.name if vehicle_type else "Unknown",
                "dock_name": dock.name if dock else "Unknown",
                "status": booking.status,
                "slots_count": len(slots),
                "created_at": booking.created_at.isoformat(),
                "supplier_name": supplier.name if supplier else None,
                "zone_name": zone.name if zone else None,
                "transport_type_name": transport_type.name if transport_type else None,
                "cubes": booking.cubes,
                "transport_sheet": booking.transport_sheet
            })
    
    return result

@router.get("/{booking_id}/slots")
def get_booking_slots(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить слоты конкретной записи"""
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    slots = db.query(models.TimeSlot, models.Dock).join(
        models.BookingTimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id
    ).join(
        models.Dock, models.TimeSlot.dock_id == models.Dock.id
    ).filter(models.BookingTimeSlot.booking_id == booking_id).all()
    
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

@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить запись (только если она отменена)"""
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.user_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status == "confirmed":
        raise HTTPException(status_code=400, detail="Cannot delete confirmed booking. Cancel it first.")
    
    # Удаляем связи с слотами
    db.query(models.BookingTimeSlot).filter(models.BookingTimeSlot.booking_id == booking_id).delete()
    
    # Удаляем запись
    db.delete(booking)
    db.commit()
    
    return {"message": "Booking deleted successfully"}
