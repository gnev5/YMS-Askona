from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from typing import List
from datetime import datetime, timedelta
import uuid
import logging
from .. import models, schemas
from ..db import get_db
from ..deps import get_current_user
from .prr_limits import get_duration
from openpyxl import Workbook, load_workbook
from io import BytesIO

router = APIRouter()

@router.post("/", response_model=schemas.Booking)
def create_booking(booking: schemas.BookingCreateUpdated, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Создание новой записи на ПРР (обновленная версия)"""
    logging.info(f"--- create_booking START for user {current_user.id} ---")
    logging.info(f"Received booking data: {booking.dict()}")

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
    logging.info(f"Calculated duration: {duration} mins, required_slots: {required_slots}")
    
    # Парсим дату и время начала
    booking_date = datetime.strptime(booking.booking_date, "%Y-%m-%d").date()
    start_time = datetime.strptime(booking.start_time, "%H:%M").time()
    logging.info(f"Parsed booking_date: {booking_date}, start_time: {start_time}")

    # Сначала проверим выбранный слот, если передан
    chosen_slots = None
    if booking.time_slot_id:
        logging.info(f"Attempting to book with specific time_slot_id: {booking.time_slot_id}")
        initial_slot = db.query(models.TimeSlot).filter(models.TimeSlot.id == booking.time_slot_id).first()
        
        if initial_slot:
            logging.info(f"Initial slot found: id={initial_slot.id}, available={initial_slot.is_available}, date={initial_slot.slot_date}, time={initial_slot.start_time}")
        else:
            logging.info("Initial slot not found.")

        if initial_slot and initial_slot.is_available and initial_slot.slot_date == booking_date and initial_slot.start_time == start_time:
            logging.info("Initial slot checks passed.")
            # Получаем слоты для этого дока начиная с выбранного
            dock_slots = db.query(models.TimeSlot).join(models.Dock).filter(
                models.TimeSlot.dock_id == initial_slot.dock_id,
                models.TimeSlot.slot_date == booking_date,
                models.TimeSlot.start_time >= start_time,
                models.TimeSlot.is_available == True,
                models.Dock.object_id == booking.object_id
            ).order_by(models.TimeSlot.start_time).all()
            logging.info(f"Found {len(dock_slots)} subsequent slots for the same dock.")

            # Найдем индекс начального слота
            start_index = None
            for idx, slot in enumerate(dock_slots):
                if slot.id == initial_slot.id:
                    start_index = idx
                    break
            logging.info(f"Found start_index: {start_index}")

            if start_index is not None and start_index + required_slots <= len(dock_slots):
                logging.info("Sufficient subsequent slots found.")
                candidate_chain = dock_slots[start_index:start_index + required_slots]
                logging.info(f"Candidate chain of {len(candidate_chain)} slots: {[s.id for s in candidate_chain]}")

                # Проверим непрерывность
                is_continuous = True
                for j in range(len(candidate_chain) - 1):
                    if candidate_chain[j].end_time != candidate_chain[j + 1].start_time:
                        is_continuous = False
                        logging.info(f"Chain is not continuous at index {j}. Slot {candidate_chain[j].id} ends at {candidate_chain[j].end_time}, next slot {candidate_chain[j+1].id} starts at {candidate_chain[j+1].start_time}")
                        break
                
                if is_continuous:
                    logging.info("Chain is continuous.")
                    # Проверим лимиты пропускной способности объекта
                    dock = db.query(models.Dock).filter(models.Dock.id == initial_slot.dock_id).first()
                    obj_for_check = dock.object if dock else None

                    capacity_block = False
                    if dock and obj_for_check:
                        logging.info(f"Checking object capacity for object_id: {obj_for_check.id}")
                        limits_to_check = []
                        if dock.dock_type == models.DockType.entrance:
                            limits_to_check.append(("in", obj_for_check.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                        elif dock.dock_type == models.DockType.exit:
                            limits_to_check.append(("out", obj_for_check.capacity_out, [models.DockType.exit, models.DockType.universal]))
                        else:  # universal -> проверяем лимит в зависимости от типа бронирования
                            if booking.booking_type == 'in':
                                limits_to_check.append(("in", obj_for_check.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                            elif booking.booking_type == 'out':
                                limits_to_check.append(("out", obj_for_check.capacity_out, [models.DockType.exit, models.DockType.universal]))
                        
                        logging.info(f"Limits to check: {limits_to_check}")

                        for direction, cap_limit, types_to_use in limits_to_check:
                            if not cap_limit or cap_limit <= 0:
                                logging.info("No capacity limit set or limit is zero. Skipping check.")
                                continue
                            logging.info(f"Checking {direction} capacity. Limit: {cap_limit}")
                            for slot in candidate_chain:
                                occupancy_obj = db.query(func.count(models.BookingTimeSlot.id)).join(models.Booking, models.BookingTimeSlot.booking_id == models.Booking.id).join(
                                    models.TimeSlot, models.BookingTimeSlot.time_slot_id == models.TimeSlot.id
                                ).join(
                                    models.Dock, models.TimeSlot.dock_id == models.Dock.id
                                ).filter(
                                    models.Dock.object_id == obj_for_check.id,
                                    models.Dock.dock_type.in_(types_to_use),
                                    models.TimeSlot.slot_date == slot.slot_date,
                                    models.TimeSlot.start_time == slot.start_time,
                                    models.TimeSlot.end_time == slot.end_time,
                                    models.Booking.status == "confirmed"
                                ).scalar() or 0
                                logging.info(f"Slot {slot.id} ({slot.start_time}): Object occupancy is {occupancy_obj}")
                                if occupancy_obj >= cap_limit:
                                    capacity_block = True
                                    logging.warning(f"Object capacity limit reached for slot {slot.id}. Occupancy ({occupancy_obj}) >= Limit ({cap_limit})")
                                    break
                            if capacity_block:
                                break

                    if not capacity_block:
                        logging.info("Object capacity check passed.")
                        # Проверим доступность
                        all_available = True
                        for slot in candidate_chain:
                            current_occupancy = db.query(func.count(models.BookingTimeSlot.id)).filter(
                                models.BookingTimeSlot.time_slot_id == slot.id
                            ).scalar() or 0
                            logging.info(f"Slot {slot.id}: current_occupancy={current_occupancy}, capacity={slot.capacity}")
                            if current_occupancy >= slot.capacity:
                                all_available = False
                                logging.warning(f"Slot capacity limit reached for slot {slot.id}. Occupancy ({current_occupancy}) >= Capacity ({slot.capacity})")
                                break

                        if all_available:
                            logging.info("Slot capacity check passed. Setting chosen_slots.")
                            chosen_slots = candidate_chain
                        else:
                            logging.warning("Slot capacity check failed.")
                    else:
                        logging.warning("Object capacity check failed.")
                else:
                    logging.warning("Continuity check failed.")
            else:
                logging.warning("Not enough subsequent slots available in dock_slots.")
        else:
            logging.warning("Initial slot check failed (is_available, date, or time mismatch).")

    logging.info(f"Value of chosen_slots after specific slot check: {[s.id for s in chosen_slots] if chosen_slots else 'None'}")

    # Если выбранный слот не подошел, ищем любой доступный
    if not chosen_slots:
        logging.info("Specific slot not booked. Searching for any available slot.")
        # Находим доступные слоты
        available_slots = db.query(models.TimeSlot).join(models.Dock).filter(
            models.TimeSlot.slot_date == booking_date,
            models.TimeSlot.start_time >= start_time,
            models.TimeSlot.is_available == True,
            models.Dock.object_id == booking.object_id
        ).order_by(models.TimeSlot.start_time).all()
        logging.info(f"Found {len(available_slots)} total available slots for the object.")
    else:
        available_slots = []

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
    logging.info(f"Searching docks in order: {sorted_dock_ids}")
    
    # Ищем подходящую цепочку слотов
    if not chosen_slots: # Ensure chosen_slots is explicitly reset if the first block failed
        chosen_slots = None 
    for dock_id in sorted_dock_ids:
        logging.info(f"--- Checking Dock ID: {dock_id} ---")
        dock_slots = slots_by_dock[dock_id]
        # Сортируем слоты по времени
        dock_slots.sort(key=lambda x: x.start_time)
        
        dock = dock_map.get(dock_id)
        obj = dock.object if dock else None

        # Пропускаем доки неподходящего типа
        if booking.booking_type == 'in' and dock and dock.dock_type == models.DockType.exit:
            logging.info(f"Skipping dock {dock_id}: type is 'exit' for an 'in' booking.")
            continue
        if booking.booking_type == 'out' and dock and dock.dock_type == models.DockType.entrance:
            logging.info(f"Skipping dock {dock_id}: type is 'entrance' for an 'out' booking.")
            continue
        
        # Проверяем, разрешен ли тип перевозки для этого дока
        if booking.transport_type_id and dock and dock.available_transport_types:
            allowed_transport_ids = {t.id for t in dock.available_transport_types}
            if booking.transport_type_id not in allowed_transport_ids:
                logging.info(f"Skipping dock {dock_id}: transport_type_id {booking.transport_type_id} not allowed.")
                continue # Переходим к следующему доку

        # Ищем непрерывную цепочку нужной длины
        for i in range(len(dock_slots) - required_slots + 1):
            chain = dock_slots[i:i + required_slots]
            logging.info(f"Checking chain in dock {dock_id}: {[s.id for s in chain]}")
            
            # Проверяем, что слоты идут подряд
            is_continuous = True
            for j in range(len(chain) - 1):
                if chain[j].end_time != chain[j + 1].start_time:
                    is_continuous = False
                    break
            
            if not is_continuous:
                logging.info("Chain is not continuous. Skipping.")
                continue
            
            # Проверяем лимиты пропускной способности объекта по направлению
            if dock and obj:
                limits_to_check = []
                if dock.dock_type == models.DockType.entrance:
                    limits_to_check.append(("in", obj.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                elif dock.dock_type == models.DockType.exit:
                    limits_to_check.append(("out", obj.capacity_out, [models.DockType.exit, models.DockType.universal]))
                else:  # universal
                    if booking.booking_type == 'in':
                        limits_to_check.append(("in", obj.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                    elif booking.booking_type == 'out':
                        limits_to_check.append(("out", obj.capacity_out, [models.DockType.exit, models.DockType.universal]))

                capacity_block = False
                for _, cap_limit, types_to_use in limits_to_check:
                    if not cap_limit or cap_limit <= 0:
                        continue
                    for slot in chain:
                        occupancy_obj = db.query(func.count(models.BookingTimeSlot.id)).join(models.Booking, models.BookingTimeSlot.booking_id == models.Booking.id).join(
                            models.TimeSlot, models.BookingTimeSlot.time_slot_id == models.TimeSlot.id
                        ).join(
                            models.Dock, models.TimeSlot.dock_id == models.Dock.id
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
                    logging.info(f"Object capacity block for this chain in dock {dock_id}.")
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
                logging.info(f"Found a valid chain in dock {dock_id}. Breaking search.")
                chosen_slots = chain
                break
        
        if chosen_slots:
            break
    
    if not chosen_slots:
        logging.error("--- No suitable slots found. Raising 409 Conflict. ---")
        raise HTTPException(
            status_code=409, 
            detail="No available time slots found for the requested period"
        )
    
    logging.info(f"--- Booking successful. Creating booking with slots: {[s.id for s in chosen_slots]} ---")
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