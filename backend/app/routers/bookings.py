from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from typing import List
from collections import defaultdict
from datetime import date, datetime, timedelta, time, timezone
import uuid
import logging
from .. import models, schemas
from ..db import get_db
from ..deps import get_current_user
from .prr_limits import get_duration
from ..quota_utils import calculate_used_volume, get_quota_for_date
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from io import BytesIO

router = APIRouter()
MSK_TZ = timezone(timedelta(hours=3))
NOON_MSK = time(15, 0)
EXPORT_RED_FILL = PatternFill(fill_type="solid", fgColor="FFFEE2E2")
EXPORT_ORANGE_FILL = PatternFill(fill_type="solid", fgColor="FFFED7AA")
EXPORT_YELLOW_FILL = PatternFill(fill_type="solid", fgColor="FFFEF9C3")
EXPORT_GREY_FILL = PatternFill(fill_type="solid", fgColor="FFE5E7EB")
EXPORT_SUMMARY_HEADER_FILL = PatternFill(fill_type="solid", fgColor="FFE0F2FE")
OWN_PRODUCTION_REPORT_ROWS = [
    "Лопатина",
    "Почаевский",
    "Солвис",
    "Софт Слип",
    "Социалистическая",
    "ЦРСГП",
]
OWN_PRODUCTION_FIXED_CUBES = {
    "Лопатина": 38,
    "Почаевский": 64,
    "Солвис": 31,
    "ЦРСГП": 64,
}


def _normalize_report_text(value: str | None) -> str:
    return (value or "").strip().lower().replace("ё", "е")


def _resolve_own_production_report_direction(supplier_name: str | None) -> str | None:
    normalized = _normalize_report_text(supplier_name)
    if "лопатина" in normalized and "литвуд" in normalized:
        return "Лопатина"
    if "почайк" in normalized or "почаев" in normalized:
        return "Почаевский"
    if "солвис" in normalized:
        return "Солвис"
    if "софт слип" in normalized and ("ковров" in normalized or "владимир" in normalized):
        return "Софт Слип"
    if "социальст" in normalized or "социалист" in normalized:
        return "Социалистическая"
    if "црсгп" in normalized:
        return "ЦРСГП"
    return None


def _is_purchased_report_row(transport_type_name: str | None) -> bool:
    return _normalize_report_text(transport_type_name) == "закупная"


def _is_own_production_report_row(transport_type_name: str | None) -> bool:
    normalized = _normalize_report_text(transport_type_name)
    return normalized in {"собственное производство", "собственное"}


def _parse_report_booking_date(serialized: dict) -> date | None:
    raw_date = serialized.get("booking_date")
    if not raw_date:
        return None
    try:
        booking_date = datetime.strptime(str(raw_date)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None

    raw_start = (serialized.get("start_time") or "")[:5]
    try:
        start_time = datetime.strptime(raw_start, "%H:%M").time()
    except ValueError:
        start_time = time(0, 0)

    if start_time >= time(22, 0):
        return booking_date + timedelta(days=1)
    return booking_date


def _report_number(value) -> float:
    if value is None or value == "":
        return 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def _report_cell_number(value: float):
    return int(value) if float(value).is_integer() else value


def _append_summary_table(ws, first_column_label: str, rows: list[tuple[str, dict[date, float]]], report_dates: list[date]):
    header = [first_column_label, *[d.isoformat() for d in report_dates], "Общий итог"]
    ws.append(header)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = EXPORT_SUMMARY_HEADER_FILL

    for label, values_by_date in rows:
        total = sum(values_by_date.values())
        ws.append([
            label,
            *[_report_cell_number(values_by_date.get(report_date, 0)) for report_date in report_dates],
            _report_cell_number(total),
        ])

    ws.freeze_panes = "B2"
    ws.column_dimensions["A"].width = max(len(first_column_label), 24)
    for idx in range(2, len(header) + 1):
        ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = 14


def _append_bookings_report_sheets(wb: Workbook, serialized_rows: list[dict]) -> None:
    own_totals: dict[str, dict[date, float]] = {
        label: defaultdict(float) for label in OWN_PRODUCTION_REPORT_ROWS
    }
    purchased_totals: dict[str, dict[date, float]] = {"Закупная": defaultdict(float)}
    report_dates: set[date] = set()

    for serialized in serialized_rows:
        report_date = _parse_report_booking_date(serialized)
        if report_date is None:
            continue

        transport_type_name = serialized.get("transport_type_name")
        supplier_name = serialized.get("supplier_name")
        direction = _resolve_own_production_report_direction(supplier_name)

        if direction is not None and _is_own_production_report_row(transport_type_name):
            cubes = OWN_PRODUCTION_FIXED_CUBES.get(direction)
            if cubes is None:
                cubes = _report_number(serialized.get("cubes"))
            own_totals[direction][report_date] += cubes
            report_dates.add(report_date)
            continue

        if _is_purchased_report_row(transport_type_name):
            purchased_totals["Закупная"][report_date] += _report_number(serialized.get("cubes"))
            report_dates.add(report_date)

    ordered_dates = sorted(report_dates)

    own_rows = [(label, own_totals[label]) for label in OWN_PRODUCTION_REPORT_ROWS]
    own_grand_total = defaultdict(float)
    for _label, values_by_date in own_rows:
        for report_date, value in values_by_date.items():
            own_grand_total[report_date] += value
    own_rows.append(("Общий итог", own_grand_total))

    own_ws = wb.create_sheet(title="Собственное производство")
    _append_summary_table(own_ws, "Направление", own_rows, ordered_dates)

    purchased_ws = wb.create_sheet(title="Закупная")
    _append_summary_table(purchased_ws, "Тип перевозки", [("Закупная", purchased_totals["Закупная"])], ordered_dates)


def _dock_matches_supplier_zone(dock: models.Dock, supplier_zone_id: int | None) -> bool:
    if supplier_zone_id is None:
        return True
    if not dock.available_zones:
        return True
    return any(zone.id == supplier_zone_id for zone in dock.available_zones)


def _to_msk(created_at: datetime) -> datetime:
    if created_at.tzinfo is None:
        created_utc = created_at.replace(tzinfo=timezone.utc)
    else:
        created_utc = created_at.astimezone(timezone.utc)
    return created_utc.astimezone(MSK_TZ)


def _is_after_noon_for_next_day_msk(created_at: datetime, booking_date) -> bool:
    created_msk = _to_msk(created_at)
    return created_msk.time() > NOON_MSK and booking_date == (created_msk.date() + timedelta(days=1))


def _is_post_factum_by_start_msk(created_at: datetime, booking_date, slot_start_time: time) -> bool:
    created_msk = _to_msk(created_at)
    slot_start_msk = datetime.combine(booking_date, slot_start_time).replace(tzinfo=MSK_TZ)
    return created_msk > slot_start_msk


def _is_created_today_for_today_msk(created_at: datetime, booking_date) -> bool:
    created_msk = _to_msk(created_at)
    return created_msk.date() == booking_date


def _serialize_booking_from_slots(booking: models.Booking, slots: list[tuple[models.TimeSlot, models.Dock]], include_user: bool = False):
    if not slots:
        logging.warning(f"No slots found for booking {booking.id}")
        return None

    first_slot, first_dock = slots[0]
    last_slot, _ = slots[-1]

    object_id = first_dock.object_id if first_dock else None
    object_name = first_dock.object.name if getattr(first_dock, "object", None) else None

    data = {
        "id": booking.id,
        "booking_date": first_slot.slot_date.isoformat(),
        "start_time": first_slot.start_time.strftime("%H:%M:%S"),
        "end_time": last_slot.end_time.strftime("%H:%M:%S"),
        "user_id": booking.user_id,
        "vehicle_plate": booking.vehicle_plate or "",
        "driver_name": booking.driver_full_name or "",
        "driver_full_name": booking.driver_full_name or "",
        "driver_phone": booking.driver_phone or "",
        "vehicle_type_name": booking.vehicle_type.name if booking.vehicle_type else "",
        "dock_name": first_dock.name if first_dock else "",
        "status": booking.status,
        "slots_count": len(slots),
        "created_at": booking.created_at.isoformat(),
        "supplier_name": booking.supplier.name if booking.supplier else None,
        "zone_name": booking.zone.name if booking.zone else None,
        "transport_type_name": booking.transport_type.name if booking.transport_type else None,
        "cubes": booking.cubes,
        "transport_sheet": booking.transport_sheet,
        "object_id": object_id,
        "object_name": object_name,
        "booking_type": booking.booking_type.value if getattr(booking, "booking_type", None) else None,
        "is_after_noon_for_next_day_msk": _is_after_noon_for_next_day_msk(booking.created_at, first_slot.slot_date),
        "is_post_factum_msk": _is_post_factum_by_start_msk(
            booking.created_at,
            first_slot.slot_date,
            first_slot.start_time,
        ),
        "is_created_today_for_today_msk": _is_created_today_for_today_msk(
            booking.created_at,
            first_slot.slot_date,
        ),
    }

    if include_user and booking.user:
        data["user_email"] = booking.user.email
        data["user_login"] = booking.user.email  # login = email
        data["user_full_name"] = booking.user.full_name

    return data


def _serialize_bookings_bulk(db: Session, bookings: list[models.Booking], include_user: bool = False) -> dict[int, dict]:
    booking_ids = [booking.id for booking in bookings]
    if not booking_ids:
        return {}

    slots_by_booking: dict[int, list[tuple[models.TimeSlot, models.Dock]]] = defaultdict(list)
    slot_rows = db.query(models.BookingTimeSlot.booking_id, models.TimeSlot, models.Dock).join(
        models.TimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id
    ).join(
        models.Dock, models.TimeSlot.dock_id == models.Dock.id
    ).options(
        joinedload(models.Dock.object)
    ).filter(
        models.BookingTimeSlot.booking_id.in_(booking_ids)
    ).order_by(
        models.BookingTimeSlot.booking_id,
        models.TimeSlot.slot_date,
        models.TimeSlot.start_time,
    ).all()

    for booking_id, slot, dock in slot_rows:
        slots_by_booking[booking_id].append((slot, dock))

    serialized_by_id: dict[int, dict] = {}
    for booking in bookings:
        serialized = _serialize_booking_from_slots(booking, slots_by_booking.get(booking.id, []), include_user=include_user)
        if serialized:
            serialized_by_id[booking.id] = serialized
    return serialized_by_id


def _serialize_booking(db: Session, booking: models.Booking, include_user: bool = False):
    slots = db.query(models.TimeSlot, models.Dock).join(
        models.BookingTimeSlot, models.TimeSlot.id == models.BookingTimeSlot.time_slot_id
    ).join(
        models.Dock, models.TimeSlot.dock_id == models.Dock.id
    ).options(
        joinedload(models.Dock.object)
    ).filter(
        models.BookingTimeSlot.booking_id == booking.id
    ).order_by(models.TimeSlot.slot_date, models.TimeSlot.start_time).all()

    return _serialize_booking_from_slots(booking, slots, include_user=include_user)


def _resolve_export_row_fill(serialized: dict) -> PatternFill | None:
    if serialized.get("status") == "cancelled":
        return EXPORT_GREY_FILL
    # Keep same priority as UI for active bookings: red > orange > yellow.
    if bool(serialized.get("is_post_factum_msk")):
        return EXPORT_RED_FILL
    if bool(serialized.get("is_created_today_for_today_msk")):
        return EXPORT_ORANGE_FILL
    if bool(serialized.get("is_after_noon_for_next_day_msk")):
        return EXPORT_YELLOW_FILL
    return None

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

    supplier_zone_id: int | None = None
    if booking.supplier_id:
        supplier = db.query(models.Supplier).options(
            joinedload(models.Supplier.vehicle_types),
            joinedload(models.Supplier.zone),
        ).filter(models.Supplier.id == booking.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        supplier_zone_id = supplier.zone_id

        if booking.zone_id is not None and booking.zone_id != supplier_zone_id:
            raise HTTPException(status_code=400, detail="Booking zone must match supplier zone")

        if supplier.vehicle_types:
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
    next_date = booking_date + timedelta(days=1)  # допускаем перетекание на следующий день
    logging.info(f"Parsed booking_date: {booking_date}, start_time: {start_time}")

    try:
        booking_direction = models.BookingDirection(booking.booking_type or "in")
    except Exception:
        raise HTTPException(status_code=400, detail="booking_type must be 'in' or 'out'")

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
            # Получаем слоты для этого дока начиная с выбранного (разрешаем следующий день)
            dock_slots = db.query(models.TimeSlot).join(models.Dock).filter(
                models.TimeSlot.dock_id == initial_slot.dock_id,
                models.TimeSlot.slot_date.in_([booking_date, next_date]),
                models.TimeSlot.is_available == True,
                models.Dock.object_id == booking.object_id
            ).order_by(models.TimeSlot.slot_date, models.TimeSlot.start_time).all()
            logging.info(f"Found {len(dock_slots)} subsequent slots for the same dock (can span to next day).")

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

                # Проверим непрерывность по datetime (учитывая переход на следующий день)
                is_continuous = True
                for j in range(len(candidate_chain) - 1):
                    current_end = datetime.combine(candidate_chain[j].slot_date, candidate_chain[j].end_time)
                    next_start = datetime.combine(candidate_chain[j + 1].slot_date, candidate_chain[j + 1].start_time)
                    if current_end != next_start:
                        is_continuous = False
                        logging.info(
                            f"Chain is not continuous at index {j}. Slot {candidate_chain[j].id} "
                            f"ends at {current_end}, next slot {candidate_chain[j+1].id} starts at {next_start}"
                        )
                        break
                
                if is_continuous:
                    logging.info("Chain is continuous.")
                    # Проверим лимиты пропускной способности объекта
                    dock = db.query(models.Dock).options(
                        joinedload(models.Dock.available_zones)
                    ).filter(models.Dock.id == initial_slot.dock_id).first()
                    obj_for_check = dock.object if dock else None

                    capacity_block = False
                    if dock and obj_for_check:
                        if not _dock_matches_supplier_zone(dock, supplier_zone_id):
                            logging.info(
                                f"Initial slot dock {dock.id} is not allowed for supplier zone {supplier_zone_id}."
                            )
                            capacity_block = True
                        logging.info(f"Checking object capacity for object_id: {obj_for_check.id}")
                        limits_to_check = []
                        if dock.dock_type == models.DockType.entrance:
                            limits_to_check.append(("in", obj_for_check.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                        elif dock.dock_type == models.DockType.exit:
                            limits_to_check.append(("out", obj_for_check.capacity_out, [models.DockType.exit, models.DockType.universal]))
                        else:  # universal -> проверяем лимит в зависимости от типа бронирования
                            if booking_direction == models.BookingDirection.inbound:
                                limits_to_check.append(("in", obj_for_check.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                            elif booking_direction == models.BookingDirection.outbound:
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
                            current_occupancy = db.query(func.count(models.BookingTimeSlot.id)).join(
                                models.Booking, models.BookingTimeSlot.booking_id == models.Booking.id
                            ).filter(
                                models.BookingTimeSlot.time_slot_id == slot.id,
                                models.Booking.status == "confirmed",
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
            models.TimeSlot.slot_date.in_([booking_date, next_date]),
            models.TimeSlot.is_available == True,
            models.Dock.object_id == booking.object_id
        ).filter(
            (models.TimeSlot.slot_date > booking_date) | (models.TimeSlot.start_time >= start_time)
        ).order_by(models.TimeSlot.slot_date, models.TimeSlot.start_time).all()
        logging.info(f"Found {len(available_slots)} total available slots for the object (spanning start and next day).")
    else:
        available_slots = []

    # Группируем слоты по докам
    slots_by_dock = {}
    for slot in available_slots:
        if slot.dock_id not in slots_by_dock:
            slots_by_dock[slot.dock_id] = []
        slots_by_dock[slot.dock_id].append(slot)

    dock_ids = list(slots_by_dock.keys())
    docks_from_db = (
        db.query(models.Dock).options(
            joinedload(models.Dock.available_transport_types),
            joinedload(models.Dock.available_zones),
        ).filter(models.Dock.id.in_(dock_ids)).all() if dock_ids else []
    )
    dock_map = {d.id: d for d in docks_from_db}

    # Сортируем доки по приоритету в зависимости от типа бронирования
    def sort_key(dock_id):
        dock = dock_map.get(dock_id)
        if not dock:
            return 3 # Should not happen
        
        if booking_direction == models.BookingDirection.outbound:
            if dock.dock_type == models.DockType.exit:
                return 0
            if dock.dock_type == models.DockType.universal:
                return 1
        elif booking_direction == models.BookingDirection.inbound:
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
        # Сортируем слоты по дате и времени, чтобы корректно обрабатывать переход через сутки
        dock_slots.sort(key=lambda x: (x.slot_date, x.start_time))
        
        dock = dock_map.get(dock_id)
        obj = dock.object if dock else None

        # Пропускаем доки неподходящего типа
        if booking_direction == models.BookingDirection.inbound and dock and dock.dock_type == models.DockType.exit:
            logging.info(f"Skipping dock {dock_id}: type is 'exit' for an 'in' booking.")
            continue
        if booking_direction == models.BookingDirection.outbound and dock and dock.dock_type == models.DockType.entrance:
            logging.info(f"Skipping dock {dock_id}: type is 'entrance' for an 'out' booking.")
            continue
        if dock and not _dock_matches_supplier_zone(dock, supplier_zone_id):
            logging.info(f"Skipping dock {dock_id}: not allowed for supplier zone {supplier_zone_id}.")
            continue
        
        # Проверяем, разрешен ли тип перевозки для этого дока
        if booking.transport_type_id and dock and dock.available_transport_types:
            allowed_transport_ids = {t.id for t in dock.available_transport_types}
            if booking.transport_type_id not in allowed_transport_ids:
                logging.info(f"Skipping dock {dock_id}: transport_type_id {booking.transport_type_id} not allowed.")
                continue # Переходим к следующему доку

        # Ищем слоты строго начиная с запрошенного времени; допускаем перерывы в расписании,
        # но не допускаем занятые слоты (capacity) в середине цепочки.
        start_idx = next((idx for idx, s in enumerate(dock_slots) if s.slot_date == booking_date and s.start_time == start_time), None)
        if start_idx is None:
            logging.info(f"No starting slot at {start_time} in dock {dock_id}. Skipping dock.")
            continue

        accumulated_minutes = 0
        candidate_chain = []
        valid_dock = True

        for slot in dock_slots[start_idx:]:
            # Проверяем лимиты пропускной способности объекта по направлению
            if dock and obj:
                limits_to_check = []
                if dock.dock_type == models.DockType.entrance:
                    limits_to_check.append(("in", obj.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                elif dock.dock_type == models.DockType.exit:
                    limits_to_check.append(("out", obj.capacity_out, [models.DockType.exit, models.DockType.universal]))
                else:  # universal
                    if booking_direction == models.BookingDirection.inbound:
                        limits_to_check.append(("in", obj.capacity_in, [models.DockType.entrance, models.DockType.universal]))
                    elif booking_direction == models.BookingDirection.outbound:
                        limits_to_check.append(("out", obj.capacity_out, [models.DockType.exit, models.DockType.universal]))

                capacity_block = False
                for _, cap_limit, types_to_use in limits_to_check:
                    if not cap_limit or cap_limit <= 0:
                        continue
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
                    logging.info(f"Object capacity block for slot {slot.id} in dock {dock_id}.")
                    valid_dock = False
                    break

            # Проверяем занятость слота
            current_occupancy = db.query(func.count(models.BookingTimeSlot.id)).join(
                models.Booking, models.BookingTimeSlot.booking_id == models.Booking.id
            ).filter(
                models.BookingTimeSlot.time_slot_id == slot.id,
                models.Booking.status == "confirmed",
            ).scalar() or 0
            if current_occupancy >= slot.capacity:
                logging.info(f"Slot {slot.id} in dock {dock_id} is fully occupied. Dock rejected.")
                valid_dock = False
                break

            candidate_chain.append(slot)
            slot_minutes = int((datetime.combine(slot.slot_date, slot.end_time) - datetime.combine(slot.slot_date, slot.start_time)).total_seconds() // 60)
            accumulated_minutes += slot_minutes

            if accumulated_minutes >= duration:
                chosen_slots = candidate_chain
                logging.info(f"Accumulated required duration in dock {dock_id}. Slots: {[s.id for s in candidate_chain]}")
                break

        if chosen_slots:
            break
        if not valid_dock:
            logging.info(f"Dock {dock_id} rejected due to occupied slot or capacity block.")
            continue
    
    if not chosen_slots:
        logging.error("--- No suitable slots found. Raising 409 Conflict. ---")
        raise HTTPException(
            status_code=409, 
            detail="На запрошенный период не найдено доступных временных слотов"
        )

    quota, total_quota_volume = get_quota_for_date(
        db=db,
        object_id=booking.object_id,
        transport_type_id=booking.transport_type_id,
        target_date=booking_date,
        direction=booking_direction,
    )
    if quota and total_quota_volume is not None:
        if booking.cubes is None:
            raise HTTPException(status_code=400, detail="Volume (cubes) is required because a quota applies on this date")
        used_volume = calculate_used_volume(
            db=db,
            object_id=booking.object_id,
            transport_type_id=booking.transport_type_id,
            target_date=booking_date,
            direction=booking_direction,
        )
        remaining_volume = total_quota_volume - used_volume
        if not quota.allow_overbooking and booking.cubes > remaining_volume:
            raise HTTPException(
                status_code=400,
                detail=f"Quota exceeded for {booking_date}. Remaining: {remaining_volume}, requested: {booking.cubes}",
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
        transport_sheet=booking.transport_sheet,
        booking_type=booking_direction,
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
    booking_query = db.query(models.Booking).filter(models.Booking.id == booking_id)
    if current_user.role != models.UserRole.admin:
        booking_query = booking_query.filter(models.Booking.user_id == current_user.id)
    booking = booking_query.first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail="Booking is not in confirmed status")
    
    booking.status = "cancelled"
    booking.updated_at = datetime.utcnow()
    
    # Связи со слотами сохраняем для истории/выгрузок; доступность считает только confirmed.
    db.commit()
    
    return {"message": "Booking cancelled successfully"}

@router.get("/all", response_model=List[schemas.BookingWithDetails])
def get_all_bookings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Получить все записи (только для администраторов)"""
    # Проверяем права администратора
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    bookings = db.query(models.Booking).options(
        joinedload(models.Booking.user),
        joinedload(models.Booking.vehicle_type),
        joinedload(models.Booking.supplier),
        joinedload(models.Booking.zone),
        joinedload(models.Booking.transport_type),
    ).filter(
        models.Booking.status.in_(["confirmed", "cancelled"])
    ).order_by(models.Booking.created_at.desc()).all()
    serialized_by_id = _serialize_bookings_bulk(db, bookings, include_user=True)
    
    result = []
    for booking in bookings:
        serialized = serialized_by_id.get(booking.id)
        if serialized:
            is_owner = booking.user_id == current_user.id
            serialized["is_owner"] = is_owner
            # админ и так здесь, но оставим логику единообразно
            serialized["can_modify"] = True
            result.append(serialized)
    
    return result

@router.get("/my", response_model=List[schemas.BookingWithDetails])
def get_my_bookings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Получить все записи (бывшие \"мои\"), видны всем пользователям"""
    bookings = db.query(models.Booking).options(
        joinedload(models.Booking.user),
        joinedload(models.Booking.vehicle_type),
        joinedload(models.Booking.supplier),
        joinedload(models.Booking.zone),
        joinedload(models.Booking.transport_type),
    ).filter(
        models.Booking.status.in_(["confirmed", "cancelled"])
    ).order_by(models.Booking.created_at.desc()).all()
    serialized_by_id = _serialize_bookings_bulk(db, bookings, include_user=True)
    
    result = []
    for booking in bookings:
        # Показываем владельца и права на изменение
        serialized = serialized_by_id.get(booking.id)
        if serialized:
            is_owner = booking.user_id == current_user.id
            serialized["is_owner"] = is_owner
            serialized["can_modify"] = is_owner or current_user.role == models.UserRole.admin
            result.append(serialized)
    
    return result


@router.post("/export/xlsx")
def export_bookings_xlsx(
    booking_ids: List[int] = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Экспорт выбранных бронирований в XLSX."""
    if not booking_ids:
        raise HTTPException(status_code=400, detail="No booking IDs provided")

    unique_ids = list(dict.fromkeys(booking_ids))

    bookings = (
        db.query(models.Booking)
        .options(
            joinedload(models.Booking.user),
            joinedload(models.Booking.vehicle_type),
            joinedload(models.Booking.supplier),
            joinedload(models.Booking.zone),
            joinedload(models.Booking.transport_type),
        )
        .filter(
            models.Booking.id.in_(unique_ids),
            models.Booking.status.in_(["confirmed", "cancelled"]),
        )
        .all()
    )
    booking_by_id = {b.id: b for b in bookings}
    serialized_by_id = _serialize_bookings_bulk(db, bookings, include_user=True)

    wb = Workbook()
    ws = wb.active
    ws.title = "bookings"
    ws.append([
        "Дата",
        "Время",
        "Док",
        "Объект",
        "Тип ТС",
        "Поставщик",
        "Зона",
        "Тип перевозки",
        "Кубы",
        "Транспортный лист",
        "Статус",
        "Пользователь",
        "ID бронирования",
    ])

    export_rows: list[dict] = []

    for booking_id in unique_ids:
        booking = booking_by_id.get(booking_id)
        if not booking:
            continue

        serialized = serialized_by_id.get(booking.id)
        if not serialized:
            continue
        export_rows.append(serialized)

        start_time = (serialized.get("start_time") or "")[:5]
        end_time = (serialized.get("end_time") or "")[:5]
        time_range = f"{start_time} - {end_time}" if start_time or end_time else ""
        user_label = serialized.get("user_full_name") or serialized.get("user_email") or serialized.get("user_login") or ""

        ws.append([
            serialized.get("booking_date") or "",
            time_range,
            serialized.get("dock_name") or "",
            serialized.get("object_name") or "",
            serialized.get("vehicle_type_name") or "",
            serialized.get("supplier_name") or "",
            serialized.get("zone_name") or "",
            serialized.get("transport_type_name") or "",
            serialized.get("cubes") if serialized.get("cubes") is not None else "",
            serialized.get("transport_sheet") or "",
            serialized.get("status") or "",
            user_label,
            serialized.get("id") or "",
        ])

        row_fill = _resolve_export_row_fill(serialized)
        if row_fill is not None:
            current_row = ws.max_row
            for col_idx in range(1, ws.max_column + 1):
                ws.cell(row=current_row, column=col_idx).fill = row_fill

    _append_bookings_report_sheets(wb, export_rows)

    legend_ws = wb.create_sheet(title="legend")
    legend_ws.append(["Цвет", "HEX", "Значение"])
    legend_ws.append(["", "#fee2e2", "постфактум"])
    legend_ws.append(["", "#fed7aa", "сегодня на сегодня"])
    legend_ws.append(["", "#fef9c3", "сегодня после 15:00 на завтра"])
    legend_ws.append(["", "#e5e7eb", "отменено"])

    legend_ws.cell(row=2, column=1).fill = EXPORT_RED_FILL
    legend_ws.cell(row=3, column=1).fill = EXPORT_ORANGE_FILL
    legend_ws.cell(row=4, column=1).fill = EXPORT_YELLOW_FILL
    legend_ws.cell(row=5, column=1).fill = EXPORT_GREY_FILL

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"my_bookings_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

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

    # Всегда включаем данные автора, чтобы на фронте видно, кто создал бронь
    serialized = _serialize_booking(db, booking, include_user=True)
    if not serialized:
        raise HTTPException(status_code=500, detail="Booking slots not found")

    is_owner = booking.user_id == current_user.id
    serialized["is_owner"] = is_owner
    serialized["can_modify"] = is_owner or current_user.role == models.UserRole.admin
    
    return serialized

@router.get("/{booking_id}/slots")
def get_booking_slots(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить слоты конкретной записи"""
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
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


@router.get("/import/template")
def download_booking_import_template(
    direction: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    XLSX-шаблон для импорта бронирований. direction: in|out.
    """
    dir_normalized = direction.lower()
    if dir_normalized not in ("in", "out"):
        raise HTTPException(status_code=400, detail="direction must be 'in' or 'out'")
    try:
        direction_enum = models.BookingDirection(dir_normalized)
    except Exception:
        raise HTTPException(status_code=400, detail="direction must be 'in' or 'out'")

    wb = Workbook()
    ws = wb.active
    ws.title = "bookings"
    ws.append(["transport_sheet", "supplier_name", "cubes", "booking_date", "start_time", "transport_type", "vehicle_type", "object_name", "driver_full_name", "driver_phone"])
    ws.append(["TS-001", "ООО Пример", "12.5", "2025-01-10", "09:00", "закупка", "Фура 20'", "Обухово", "Иванов И.И.", "+7 999 000-00-00"])

    ws_sup = wb.create_sheet("suppliers")
    ws_sup.append(["supplier_name", "zone_name"])
    suppliers = db.query(models.Supplier).options(joinedload(models.Supplier.zone)).all()
    for s in suppliers:
        ws_sup.append([s.name, s.zone.name if s.zone else ""])

    ws_obj = wb.create_sheet("objects")
    ws_obj.append(["object_name"])
    for obj in db.query(models.Object).all():
        ws_obj.append([obj.name])

    ws_tt = wb.create_sheet("transport_types")
    ws_tt.append(["transport_type"])
    for t in db.query(models.TransportTypeRef).all():
        ws_tt.append([t.name])

    ws_vt = wb.create_sheet("vehicle_types")
    ws_vt.append(["vehicle_type"])
    for vt in db.query(models.VehicleType).all():
        ws_vt.append([vt.name])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="booking_import_template_{dir_normalized}.xlsx"'},
    )


@router.post("/import", response_model=schemas.BookingImportResult)
def import_bookings_from_excel(
    direction: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Импорт бронирований из Excel. direction: in|out. Валидные строки создаются, ошибки возвращаются.
    """
    dir_normalized = direction.lower()
    if dir_normalized not in ("in", "out"):
        raise HTTPException(status_code=400, detail="direction must be 'in' or 'out'")

    # Normalize and validate direction to enum once, reuse below
    try:
        direction_enum = models.BookingDirection(dir_normalized)
    except Exception:
        raise HTTPException(status_code=400, detail="direction must be 'in' or 'out'")

    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Ожидается Excel файл (.xlsx)")

    try:
        wb = load_workbook(BytesIO(file.file.read()))
        ws = wb.active
    except Exception:
        raise HTTPException(status_code=400, detail="Не удалось прочитать Excel файл")

    expected_headers = ["transport_sheet", "supplier_name", "cubes", "booking_date", "start_time", "transport_type", "vehicle_type", "object_name", "driver_full_name", "driver_phone"]
    headers = [str(cell.value).strip() if cell.value is not None else "" for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    if [h.lower() for h in headers] != expected_headers:
        raise HTTPException(status_code=400, detail=f"Ожидается заголовок: {', '.join(expected_headers)}")

    suppliers = db.query(models.Supplier).options(joinedload(models.Supplier.zone)).all()
    supplier_map = {s.name.strip().lower(): s for s in suppliers}

    objects = db.query(models.Object).all()
    object_map = {o.name.strip().lower(): o for o in objects}

    transport_types = db.query(models.TransportTypeRef).all()
    transport_type_map = {t.name.strip().lower(): t for t in transport_types}

    vehicle_types = db.query(models.VehicleType).all()
    vehicle_type_map = {v.name.strip().lower(): v for v in vehicle_types}

    docks = db.query(models.Dock).options(joinedload(models.Dock.available_zones)).all()
    allowed_types = [models.DockType.universal]
    if dir_normalized == "in":
        allowed_types.append(models.DockType.entrance)
    else:
        allowed_types.append(models.DockType.exit)

    docks_by_object = {}
    for d in docks:
        if d.dock_type not in allowed_types:
            continue
        docks_by_object.setdefault(d.object_id, []).append(d)
    for lst in docks_by_object.values():
        lst.sort(key=lambda x: x.name or "")

    errors: list[schemas.BookingImportError] = []
    created = 0
    provisional_usage: dict[tuple[int, int, str, datetime.date], float] = {}

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        raw_transport_sheet, raw_supplier, raw_cubes, raw_date, raw_time, raw_transport_type, raw_vehicle_type, raw_object, raw_driver_name, raw_driver_phone = row
        transport_sheet = (raw_transport_sheet or "").strip()
        supplier_name = (raw_supplier or "").strip()
        cubes = None if raw_cubes in (None, "") else float(raw_cubes)
        booking_date_str = (raw_date or "").strip() if isinstance(raw_date, str) else (raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, "strftime") else "")
        start_time_str = (raw_time or "").strip() if isinstance(raw_time, str) else (raw_time.strftime("%H:%M") if hasattr(raw_time, "strftime") else "")
        transport_type_name = (raw_transport_type or "").strip()
        vehicle_type_name = (raw_vehicle_type or "").strip()
        object_name = (raw_object or "").strip()
        driver_name = (raw_driver_name or "").strip()
        driver_phone = (raw_driver_phone or "").strip()

        row_errors = []
        if not transport_sheet:
            row_errors.append("transport_sheet обязателен")
        if not supplier_name:
            row_errors.append("supplier_name обязателен")
        if cubes is None:
            row_errors.append("cubes обязателен")
        if not booking_date_str:
            row_errors.append("booking_date обязателен")
        if not start_time_str:
            row_errors.append("start_time обязателен")
        if not transport_type_name:
            row_errors.append("transport_type обязателен")
        if not vehicle_type_name:
            row_errors.append("vehicle_type обязателен")
        if not object_name:
            row_errors.append("object_name обязателен")

        supplier = supplier_map.get(supplier_name.lower()) if supplier_name else None
        if supplier is None:
            row_errors.append(f"supplier '{supplier_name}' не найден")
        zone_id = supplier.zone_id if supplier else None

        obj = object_map.get(object_name.lower()) if object_name else None
        if obj is None:
            row_errors.append(f"object '{object_name}' не найден")

        transport_type = transport_type_map.get(transport_type_name.lower()) if transport_type_name else None
        if transport_type is None:
            row_errors.append(f"transport_type '{transport_type_name}' не найден")

        vehicle_type = vehicle_type_map.get(vehicle_type_name.lower()) if vehicle_type_name else None
        if vehicle_type is None:
            row_errors.append(f"vehicle_type '{vehicle_type_name}' не найден")

        try:
            booking_date = datetime.strptime(booking_date_str, "%Y-%m-%d").date()
        except Exception:
            row_errors.append(f"booking_date '{booking_date_str}' некорректен")
            booking_date = None

        try:
            start_time = datetime.strptime(start_time_str, "%H:%M").time()
        except Exception:
            row_errors.append(f"start_time '{start_time_str}' некорректен")
            start_time = None

        if row_errors:
            errors.append(schemas.BookingImportError(row_number=idx, message="; ".join(row_errors)))
            continue

        # duration
        try:
            duration = get_duration(
                object_id=obj.id,
                supplier_id=supplier.id if supplier else None,
                transport_type_id=transport_type.id if transport_type else None,
                vehicle_type_id=vehicle_type.id if vehicle_type else None,
                db=db
            ).duration_minutes
        except HTTPException as e:
            if e.status_code == 404:
                duration = vehicle_type.duration_minutes
            else:
                errors.append(schemas.BookingImportError(row_number=idx, message=e.detail or "Не удалось вычислить длительность"))
                continue

        if duration <= 0:
            errors.append(schemas.BookingImportError(row_number=idx, message="Длительность должна быть больше 0"))
            continue

        required_slots = duration // 30 + (1 if duration % 30 != 0 else 0)
        candidate_docks = docks_by_object.get(obj.id, [])
        chosen_chain = None
        chosen_dock_id = None

        for dock in candidate_docks:
            # zone check
            if dock.available_zones:
                zone_ids = {z.id for z in dock.available_zones}
                if zone_id not in zone_ids:
                    continue

            slots = db.query(models.TimeSlot).filter(
                models.TimeSlot.dock_id == dock.id,
                models.TimeSlot.slot_date == booking_date
            ).order_by(models.TimeSlot.start_time).all()

            start_idx = next((i for i, s in enumerate(slots) if s.start_time == start_time), None)
            if start_idx is None:
                continue

            accumulated_minutes = 0
            chain: list[models.TimeSlot] = []
            dock_ok = True

            for s in slots[start_idx:]:
                occ = db.query(func.count(models.BookingTimeSlot.id)).join(
                    models.Booking, models.BookingTimeSlot.booking_id == models.Booking.id
                ).filter(
                    models.BookingTimeSlot.time_slot_id == s.id,
                    models.Booking.status == "confirmed"
                ).scalar() or 0
                if occ >= s.capacity:
                    dock_ok = False
                    break

                chain.append(s)
                slot_minutes = int((datetime.combine(s.slot_date, s.end_time) - datetime.combine(s.slot_date, s.start_time)).total_seconds() // 60)
                accumulated_minutes += slot_minutes

                if accumulated_minutes >= duration:
                    chosen_chain = chain
                    chosen_dock_id = dock.id
                    break

            if not dock_ok:
                continue
            if chosen_chain:
                break

        if not chosen_chain:
            errors.append(schemas.BookingImportError(row_number=idx, message="Нет свободного слота на объекте для этой зоны/времени"))
            continue


        quota = None
        total_quota_volume = None
        if transport_type:
            quota, total_quota_volume = get_quota_for_date(
                db=db,
                object_id=obj.id,
                transport_type_id=transport_type.id,
                target_date=booking_date,
                direction=direction_enum,
            )
        if quota and total_quota_volume is not None:
            if cubes is None:
                errors.append(schemas.BookingImportError(row_number=idx, message="cubes ?????????? ??? ??? ? ??????"))
                continue
            key = (obj.id, transport_type.id, direction_enum.value, booking_date)
            extra_used = provisional_usage.get(key, 0.0)
            used_volume = calculate_used_volume(
                db=db,
                object_id=obj.id,
                transport_type_id=transport_type.id,
                target_date=booking_date,
                direction=direction_enum,
            ) + extra_used
            remaining_volume = total_quota_volume - used_volume
            if not quota.allow_overbooking and cubes > remaining_volume:
                errors.append(
                    schemas.BookingImportError(
                        row_number=idx,
                        message=f"Превышена квота на {booking_date}. Остаток {remaining_volume}, заявлено {cubes}",
                    )
                )
                continue

        new_booking = models.Booking(
            user_id=current_user.id,
            vehicle_type_id=vehicle_type.id,
            vehicle_plate="",
            driver_full_name=driver_name or "",
            driver_phone=driver_phone or "",
            status="confirmed",
            supplier_id=supplier.id if supplier else None,
            zone_id=zone_id,
            transport_type_id=transport_type.id if transport_type else None,
            cubes=cubes,
            transport_sheet=transport_sheet,
            booking_type=direction_enum,
        )
        db.add(new_booking)
        db.flush()

        for s in chosen_chain:
            db.add(models.BookingTimeSlot(booking_id=new_booking.id, time_slot_id=s.id))

        # Flush immediately so subsequent rows in the same import see the newly occupied slots
        # when they calculate availability/capacity.
        db.flush()

        if quota and total_quota_volume is not None and cubes is not None and transport_type:
            key = (obj.id, transport_type.id, direction_enum.value, booking_date)
            provisional_usage[key] = provisional_usage.get(key, 0.0) + cubes

        created += 1

    if created:
        db.commit()
    else:
        db.rollback()

    return schemas.BookingImportResult(created=created, errors=errors)

