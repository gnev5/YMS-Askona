from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
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
    
    obj = db.query(models.Object).filter(models.Object.id == booking.object_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    if booking.supplier_id:
        supplier = db.query(models.Supplier).options(
            joinedload(models.Supplier.vehicle_types)
        ).filter(models.Supplier.id == booking.supplier_id).first()
        if supplier and supplier.vehicle_types:
            allowed_ids = {vt.id for vt in supplier.vehicle_types}
            if booking.vehicle_type_id not in allowed_ids:
                raise HTTPException(status_code=400, detail="Selected vehicle type is not allowed for this supplier")
    
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
    available_slots = db.query(models.TimeSlot).join(models.Dock).filter(
        models.TimeSlot.slot_date == booking_date,
        models.TimeSlot.start_time >= start_time,
        models.TimeSlot.is_available == True,
        models.Dock.object_id == booking.object_id
    ).order_by(models.TimeSlot.start_time).all()
    
    # Группируем слоты по докам
    slots_by_dock = {}
    for slot in available_slots:
        if slot.dock_id not in slots_by_dock:
            slots_by_dock[slot.dock_id] = []
        slots_by_dock[slot.dock_id].append(slot)

    dock_ids = list(slots_by_dock.keys())
    docks_from_db = db.query(models.Dock).options(joinedload(models.Dock.available_transport_types)).filter(models.Dock.id.in_(dock_ids)).all() if dock_ids else []
    dock_map = {d.id: d for d in docks_from_db}

    # Сортируем доки по приоритету в зависимости от типа бронирования
    def sort_key(dock_id):
        dock = dock_map.get(dock_id)
        if not dock:
            return 3 # Should not happen
        
        if booking.booking_type == 'out':
            if dock.dock_type == models.DockType.exit:
                return 0
            if dock.dock_type == models.DockType.universal:
                return 1
        elif booking.booking_type == 'in':
            if dock.dock_type == models.DockType.entrance:
                return 0
            if dock.dock_type == models.DockType.universal:
                return 1
        return 2 # Other types last

    sorted_dock_ids = sorted(dock_ids, key=sort_key)
    
    # Ищем подходящую цепочку слотов
    chosen_slots = None
    for dock_id in sorted_dock_ids:
        dock_slots = slots_by_dock[dock_id]
        # Сортируем слоты по времени
        dock_slots.sort(key=lambda x: x.start_time)
        
        dock = dock_map.get(dock_id)
        # obj = object_map.get(dock.object_id) if dock else None # object_map is not defined, but dock.object is available.
        obj = dock.object if dock else None

        # Пропускаем доки неподходящего типа
        if booking.booking_type == 'in' and dock and dock.dock_type == models.DockType.exit:
            continue
        if booking.booking_type == 'out' and dock and dock.dock_type == models.DockType.entrance:
            continue
        
        # Проверяем, разрешен ли тип перевозки для этого дока
        if booking.transport_type_id and dock and dock.available_transport_types:
            allowed_transport_ids = {t.id for t in dock.available_transport_types}
            if booking.transport_type_id not in allowed_transport_ids:
                continue # Переходим к следующему доку

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
            
            # Проверяем лимиты пропускной способности объекта по направлению
            if dock and obj:
                limits_to_check = []
                if dock.dock_type == models.DockType.entrance:
                    limits_to_check.append(("in", obj.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                elif dock.dock_type == models.DockType.exit:
                    limits_to_check.append(("out", obj.capacity_out, [models.DockType.exit, models.DockType.universal]))
                else:  # universal -> проверяем оба лимита, если заданы
                    limits_to_check.append(("in", obj.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                    limits_to_check.append(("out", obj.capacity_out, [models.DockType.exit, models.DockType.universal]))

                capacity_block = False
                for _, cap_limit, types_to_use in limits_to_check:
                    if not cap_limit or cap_limit <= 0:
                        continue
                    for slot in chain:
                        occupancy_obj = db.query(func.count(models.BookingTimeSlot.id)).join(
                            models.TimeSlot, models.BookingTimeSlot.time_slot_id == models.TimeSlot.id
                        ).join(
                            models.Dock, models.TimeSlot.dock_id == models.Dock.id
                        ).join(
                            models.Booking, models.BookingTimeSlot.booking_id == models.Booking.id
                        ).filter(
                            models.Dock.object_id == obj.id,
                            models.Dock.dock_type.in_(types_to_use),
                            models.TimeSlot.slot_date == slot.slot_date,
                            models.TimeSlot.start_time == slot.start_time,
                            models.TimeSlot.end_time == slot.end_time,
                            models.Booking.status == "confirmed"
                        ).scalar() or 0
                        if occupancy_obj >= cap_limit:
                            capacity_block = True
                            break
                    if capacity_block:
                        break
                if capacity_block:
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
        vehicle_plate=booking.vehicle_plate or "",
        driver_full_name=booking.driver_full_name or "",
        driver_phone=booking.driver_phone or "",
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

def _serialize_booking(db: Session, booking: models.Booking, include_user: bool = False):
    """Привести бронирование к формату BookingWithDetails"""
    slots = db.query(models.TimeSlot, models.BookingTimeSlot).join(
        models.BookingTimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id
    ).filter(models.BookingTimeSlot.booking_id == booking.id).order_by(models.TimeSlot.start_time).all()
    
    if not slots:
        return None

    first_slot = slots[0][0]
    last_slot = slots[-1][0]

    vehicle_type = db.query(models.VehicleType).filter(models.VehicleType.id == booking.vehicle_type_id).first()
    dock = db.query(models.Dock).filter(models.Dock.id == first_slot.dock_id).first()
    obj = db.query(models.Object).filter(models.Object.id == dock.object_id).first() if dock else None
    supplier = db.query(models.Supplier).filter(models.Supplier.id == booking.supplier_id).first() if booking.supplier_id else None
    zone = db.query(models.Zone).filter(models.Zone.id == booking.zone_id).first() if booking.zone_id else None
    transport_type = db.query(models.TransportTypeRef).filter(models.TransportTypeRef.id == booking.transport_type_id).first() if booking.transport_type_id else None
    user = db.query(models.User).filter(models.User.id == booking.user_id).first() if include_user else None

    data = {
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
        "object_id": obj.id if obj else None,
        "object_name": obj.name if obj else None
    }

    if include_user and user:
        data["user_email"] = user.email
        data["user_full_name"] = user.full_name

    return data

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
        serialized = _serialize_booking(db, booking, include_user=True)
        if serialized:
            result.append(serialized)
    
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
        serialized = _serialize_booking(db, booking)
        if serialized:
            result.append(serialized)
    
    return result

@router.put("/{booking_id}/transport-sheet", response_model=schemas.BookingWithDetails)
def update_transport_sheet(
    booking_id: int,
    payload: schemas.BookingTransportSheetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Обновить транспортный лист для брони"""
    query = db.query(models.Booking).filter(models.Booking.id == booking_id)
    if current_user.role != models.UserRole.admin:
        query = query.filter(models.Booking.user_id == current_user.id)
    booking = query.first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if payload.transport_sheet and len(payload.transport_sheet) > 20:
        raise HTTPException(status_code=400, detail="Transport sheet must be at most 20 characters")

    booking.transport_sheet = payload.transport_sheet or None
    booking.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)

    serialized = _serialize_booking(db, booking, include_user=current_user.role == models.UserRole.admin)
    if not serialized:
        raise HTTPException(status_code=500, detail="Booking slots not found")

    return serialized

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

@router.get("/{booking_id}", response_model=schemas.BookingWithDetails)
def get_booking_by_id(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить детальную информацию по одной записи"""
    query = db.query(models.Booking).filter(models.Booking.id == booking_id)
    
    # If not admin, restrict to own bookings
    if current_user.role != models.UserRole.admin:
        query = query.filter(models.Booking.user_id == current_user.id)
        
    booking = query.first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    serialized_booking = _serialize_booking(db, booking, include_user=current_user.role == models.UserRole.admin)
    
    if not serialized_booking:
        raise HTTPException(status_code=500, detail="Failed to serialize booking")
        
    return serialized_booking

