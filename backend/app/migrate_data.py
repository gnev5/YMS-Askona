"""
Скрипт миграции данных из старой структуры в новую
"""
from sqlalchemy.orm import Session
from datetime import date, timedelta
from .db import SessionLocal, engine, Base
from . import models
from .models_new import TimeSlot as NewTimeSlot, Booking as NewBooking, BookingTimeSlot


def migrate_data():
    """Миграция данных из старой структуры в новую"""
    db: Session = SessionLocal()
    try:
        print("Начинаем миграцию данных...")
        
        # 1. Миграция TimeSlot
        print("1. Мигрируем TimeSlot...")
        old_slots = db.query(models.TimeSlot).all()
        new_slots_created = 0
        
        # Генерируем слоты на 4 недели вперед от текущей даты
        start_date = date.today()
        end_date = start_date + timedelta(weeks=4)
        
        for old_slot in old_slots:
            current_date = start_date
            while current_date <= end_date:
                # Проверяем, что день недели совпадает
                if current_date.weekday() == old_slot.day_of_week:
                    # Проверяем, не существует ли уже такой слот
                    existing = db.query(NewTimeSlot).filter(
                        NewTimeSlot.dock_id == old_slot.dock_id,
                        NewTimeSlot.slot_date == current_date,
                        NewTimeSlot.start_time == old_slot.start_time,
                        NewTimeSlot.end_time == old_slot.end_time
                    ).first()
                    
                    if not existing:
                        new_slot = NewTimeSlot(
                            dock_id=old_slot.dock_id,
                            slot_date=current_date,
                            start_time=old_slot.start_time,
                            end_time=old_slot.end_time,
                            capacity=old_slot.capacity,
                            is_available=True
                        )
                        db.add(new_slot)
                        new_slots_created += 1
                
                current_date += timedelta(days=1)
        
        db.commit()
        print(f"   Создано {new_slots_created} новых слотов")
        
        # 2. Миграция Booking
        print("2. Мигрируем Booking...")
        old_bookings = db.query(models.Booking).all()
        
        # Группируем записи по group_id
        bookings_by_group = {}
        for old_booking in old_bookings:
            group_id = old_booking.group_id
            if group_id not in bookings_by_group:
                bookings_by_group[group_id] = []
            bookings_by_group[group_id].append(old_booking)
        
        new_bookings_created = 0
        booking_slots_created = 0
        
        for group_id, group_bookings in bookings_by_group.items():
            if not group_bookings:
                continue
                
            # Берем первую запись как основу для новой
            first_booking = group_bookings[0]
            
            # Создаем новую запись
            new_booking = NewBooking(
                user_id=first_booking.user_id,
                vehicle_type_id=first_booking.vehicle_type_id,
                vehicle_plate=first_booking.vehicle_plate,
                driver_full_name=first_booking.driver_full_name,
                driver_phone=first_booking.driver_phone,
                status="confirmed"
            )
            db.add(new_booking)
            db.flush()  # Получаем ID
            
            # Создаем связи с временными слотами
            for old_booking in group_bookings:
                # Находим соответствующий новый слот
                old_slot = db.query(models.TimeSlot).filter(
                    models.TimeSlot.id == old_booking.time_slot_id
                ).first()
                
                if old_slot:
                    # Находим новый слот по дате и времени
                    new_slot = db.query(NewTimeSlot).filter(
                        NewTimeSlot.dock_id == old_slot.dock_id,
                        NewTimeSlot.slot_date == old_booking.booking_date,
                        NewTimeSlot.start_time == old_slot.start_time,
                        NewTimeSlot.end_time == old_slot.end_time
                    ).first()
                    
                    if new_slot:
                        # Создаем связь
                        booking_slot = BookingTimeSlot(
                            booking_id=new_booking.id,
                            time_slot_id=new_slot.id
                        )
                        db.add(booking_slot)
                        booking_slots_created += 1
            
            new_bookings_created += 1
        
        db.commit()
        print(f"   Создано {new_bookings_created} новых записей")
        print(f"   Создано {booking_slots_created} связей booking-time_slot")
        
        print("Миграция завершена успешно!")
        
    except Exception as e:
        print(f"Ошибка при миграции: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def generate_slots_for_period(start_date: date, end_date: date):
    """Генерация слотов на указанный период на основе расписания"""
    db: Session = SessionLocal()
    try:
        print(f"Генерируем слоты с {start_date} по {end_date}...")
        
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
                        existing = db.query(NewTimeSlot).filter(
                            NewTimeSlot.dock_id == schedule.dock_id,
                            NewTimeSlot.slot_date == current_date,
                            NewTimeSlot.start_time == current_time,
                            NewTimeSlot.end_time == next_time
                        ).first()
                        
                        if not existing:
                            new_slot = NewTimeSlot(
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
        print(f"Создано {slots_created} новых слотов")
        
    except Exception as e:
        print(f"Ошибка при генерации слотов: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_data()
