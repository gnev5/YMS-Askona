"""
Скрипт миграции базы данных из старой структуры в новую
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, timedelta, datetime
from .db import SessionLocal, engine, Base
from . import models
from .models_backup import TimeSlot as OldTimeSlot, Booking as OldBooking


def migrate_database():
    """Основная функция миграции"""
    db: Session = SessionLocal()
    try:
        print("🚀 Начинаем миграцию базы данных...")
        
        # 1. Создаем новые таблицы
        print("1️⃣ Создаем новые таблицы...")
        Base.metadata.create_all(bind=engine)
        print("   ✅ Новые таблицы созданы")
        
        # 2. Мигрируем TimeSlot
        print("2️⃣ Мигрируем TimeSlot...")
        migrate_time_slots(db)
        
        # 3. Мигрируем Booking
        print("3️⃣ Мигрируем Booking...")
        migrate_bookings(db)
        
        # 4. Генерируем слоты на 4 недели вперед
        print("4️⃣ Генерируем слоты на 4 недели вперед...")
        generate_future_slots(db)
        
        print("🎉 Миграция завершена успешно!")
        
    except Exception as e:
        print(f"❌ Ошибка при миграции: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def migrate_time_slots(db: Session):
    """Миграция временных слотов"""
    # Проверяем, есть ли старая структура (поле day_of_week)
    try:
        old_slots = db.execute(text("SELECT day_of_week, dock_id, start_time, end_time, capacity FROM time_slots")).fetchall()
        print(f"   Найдено {len(old_slots)} старых слотов")
        
        if not old_slots:
            print("   ⚠️ Старых слотов не найдено, пропускаем миграцию")
            return
    except Exception as e:
        print(f"   ⚠️ Старая структура не найдена или уже обновлена: {e}")
        return
    
    # Генерируем слоты на 4 недели вперед от текущей даты
    start_date = date.today()
    end_date = start_date + timedelta(weeks=4)
    new_slots_created = 0
    
    for old_slot in old_slots:
        current_date = start_date
        while current_date <= end_date:
            # Проверяем, что день недели совпадает
            if current_date.weekday() == old_slot.day_of_week:
                # Проверяем, не существует ли уже такой слот
                existing = db.execute(text("""
                    SELECT id FROM time_slots 
                    WHERE dock_id = :dock_id 
                    AND slot_date = :slot_date 
                    AND start_time = :start_time 
                    AND end_time = :end_time
                """), {
                    "dock_id": old_slot.dock_id,
                    "slot_date": current_date,
                    "start_time": old_slot.start_time,
                    "end_time": old_slot.end_time
                }).fetchone()
                
                if not existing:
                    db.execute(text("""
                        INSERT INTO time_slots (dock_id, slot_date, start_time, end_time, capacity, is_available, created_at, updated_at)
                        VALUES (:dock_id, :slot_date, :start_time, :end_time, :capacity, :is_available, :created_at, :updated_at)
                    """), {
                        "dock_id": old_slot.dock_id,
                        "slot_date": current_date,
                        "start_time": old_slot.start_time,
                        "end_time": old_slot.end_time,
                        "capacity": old_slot.capacity,
                        "is_available": True,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    })
                    new_slots_created += 1
            
            current_date += timedelta(days=1)
    
    db.commit()
    print(f"   ✅ Создано {new_slots_created} новых слотов")


def migrate_bookings(db: Session):
    """Миграция записей"""
    # Получаем старые записи
    old_bookings = db.execute(text("SELECT * FROM bookings")).fetchall()
    print(f"   Найдено {len(old_bookings)} старых записей")
    
    if not old_bookings:
        print("   ⚠️ Старых записей не найдено, пропускаем миграцию")
        return
    
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
        result = db.execute(text("""
            INSERT INTO bookings (user_id, vehicle_type_id, vehicle_plate, driver_full_name, driver_phone, status, created_at, updated_at)
            VALUES (:user_id, :vehicle_type_id, :vehicle_plate, :driver_full_name, :driver_phone, :status, :created_at, :updated_at)
            RETURNING id
        """), {
            "user_id": first_booking.user_id,
            "vehicle_type_id": first_booking.vehicle_type_id,
            "vehicle_plate": first_booking.vehicle_plate,
            "driver_full_name": first_booking.driver_full_name,
            "driver_phone": first_booking.driver_phone,
            "status": "confirmed",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        new_booking_id = result.fetchone()[0]
        
        # Создаем связи с временными слотами
        for old_booking in group_bookings:
            # Находим соответствующий новый слот
            old_slot = db.execute(text("SELECT * FROM time_slots WHERE id = :id"), {
                "id": old_booking.time_slot_id
            }).fetchone()
            
            if old_slot:
                # Находим новый слот по дате и времени
                new_slot = db.execute(text("""
                    SELECT id FROM time_slots 
                    WHERE dock_id = :dock_id 
                    AND slot_date = :slot_date 
                    AND start_time = :start_time 
                    AND end_time = :end_time
                """), {
                    "dock_id": old_slot.dock_id,
                    "slot_date": old_booking.booking_date,
                    "start_time": old_slot.start_time,
                    "end_time": old_slot.end_time
                }).fetchone()
                
                if new_slot:
                    # Создаем связь
                    db.execute(text("""
                        INSERT INTO booking_time_slots (booking_id, time_slot_id)
                        VALUES (:booking_id, :time_slot_id)
                    """), {
                        "booking_id": new_booking_id,
                        "time_slot_id": new_slot.id
                    })
                    booking_slots_created += 1
        
        new_bookings_created += 1
    
    db.commit()
    print(f"   ✅ Создано {new_bookings_created} новых записей")
    print(f"   ✅ Создано {booking_slots_created} связей booking-time_slot")


def generate_future_slots(db: Session):
    """Генерация слотов на будущие периоды"""
    schedules = db.execute(text("SELECT * FROM work_schedules")).fetchall()
    slots_created = 0
    
    # Генерируем слоты на следующие 4 недели
    start_date = date.today() + timedelta(weeks=1)  # Начинаем со следующей недели
    end_date = start_date + timedelta(weeks=4)
    
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
                    existing = db.execute(text("""
                        SELECT id FROM time_slots 
                        WHERE dock_id = :dock_id 
                        AND slot_date = :slot_date 
                        AND start_time = :start_time 
                        AND end_time = :end_time
                    """), {
                        "dock_id": schedule.dock_id,
                        "slot_date": current_date,
                        "start_time": current_time,
                        "end_time": next_time
                    }).fetchone()
                    
                    if not existing:
                        db.execute(text("""
                            INSERT INTO time_slots (dock_id, slot_date, start_time, end_time, capacity, is_available, created_at, updated_at)
                            VALUES (:dock_id, :slot_date, :start_time, :end_time, :capacity, :is_available, :created_at, :updated_at)
                        """), {
                            "dock_id": schedule.dock_id,
                            "slot_date": current_date,
                            "start_time": current_time,
                            "end_time": next_time,
                            "capacity": schedule.capacity,
                            "is_available": True,
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        })
                        slots_created += 1
                    
                    current_time = next_time
        
        current_date += timedelta(days=1)
    
    db.commit()
    print(f"   ✅ Создано {slots_created} слотов на будущие периоды")


if __name__ == "__main__":
    migrate_database()
