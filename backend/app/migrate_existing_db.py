"""
Скрипт для миграции существующей базы данных
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, timedelta, datetime
from .db import SessionLocal, engine, Base
from . import models


def migrate_existing_database():
    """Миграция существующей БД с изменением структуры таблиц"""
    db: Session = SessionLocal()
    try:
        print("🚀 Начинаем миграцию существующей базы данных...")
        
        # 1. Проверяем текущую структуру
        print("1️⃣ Проверяем текущую структуру...")
        try:
            result = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'time_slots'")).fetchall()
            columns = [row[0] for row in result]
            print(f"   Текущие колонки time_slots: {columns}")
            
            if 'day_of_week' in columns and 'slot_date' not in columns:
                print("   ✅ Найдена старая структура, начинаем миграцию")
            elif 'slot_date' in columns:
                print("   ✅ Структура уже обновлена")
                return
            else:
                print("   ❌ Неожиданная структура таблицы")
                return
        except Exception as e:
            print(f"   ❌ Ошибка при проверке структуры: {e}")
            return
        
        # 2. Создаем резервную копию данных
        print("2️⃣ Создаем резервную копию данных...")
        old_slots = db.execute(text("SELECT * FROM time_slots")).fetchall()
        old_bookings = db.execute(text("SELECT * FROM bookings")).fetchall()
        print(f"   Сохранено {len(old_slots)} слотов и {len(old_bookings)} записей")
        
        # 3. Удаляем старые таблицы
        print("3️⃣ Удаляем старые таблицы...")
        db.execute(text("DROP TABLE IF EXISTS booking_time_slots CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS bookings CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS time_slots CASCADE"))
        db.commit()
        print("   ✅ Старые таблицы удалены")
        
        # 4. Создаем новые таблицы
        print("4️⃣ Создаем новые таблицы...")
        Base.metadata.create_all(bind=engine)
        print("   ✅ Новые таблицы созданы")
        
        # 5. Восстанавливаем слоты с новой структурой
        print("5️⃣ Восстанавливаем слоты...")
        slots_created = 0
        start_date = date.today()
        end_date = start_date + timedelta(weeks=4)
        
        for old_slot in old_slots:
            current_date = start_date
            while current_date <= end_date:
                if current_date.weekday() == old_slot.day_of_week:
                    new_slot = models.TimeSlot(
                        dock_id=old_slot.dock_id,
                        slot_date=current_date,
                        start_time=old_slot.start_time,
                        end_time=old_slot.end_time,
                        capacity=old_slot.capacity,
                        is_available=True
                    )
                    db.add(new_slot)
                    slots_created += 1
                current_date += timedelta(days=1)
        
        db.commit()
        print(f"   ✅ Создано {slots_created} новых слотов")
        
        # 6. Восстанавливаем записи
        print("6️⃣ Восстанавливаем записи...")
        bookings_created = 0
        booking_slots_created = 0
        
        # Группируем записи по group_id
        bookings_by_group = {}
        for old_booking in old_bookings:
            group_id = old_booking.group_id
            if group_id not in bookings_by_group:
                bookings_by_group[group_id] = []
            bookings_by_group[group_id].append(old_booking)
        
        for group_id, group_bookings in bookings_by_group.items():
            if not group_bookings:
                continue
                
            first_booking = group_bookings[0]
            
            # Создаем новую запись
            new_booking = models.Booking(
                user_id=first_booking.user_id,
                vehicle_type_id=first_booking.vehicle_type_id,
                vehicle_plate=first_booking.vehicle_plate,
                driver_full_name=first_booking.driver_full_name,
                driver_phone=first_booking.driver_phone,
                status="confirmed"
            )
            db.add(new_booking)
            db.flush()
            
            # Создаем связи с временными слотами
            for old_booking in group_bookings:
                # Находим соответствующий новый слот
                new_slot = db.query(models.TimeSlot).filter(
                    models.TimeSlot.dock_id == old_slot.dock_id,
                    models.TimeSlot.slot_date == old_booking.booking_date,
                    models.TimeSlot.start_time == old_slot.start_time,
                    models.TimeSlot.end_time == old_slot.end_time
                ).first()
                
                if new_slot:
                    booking_slot = models.BookingTimeSlot(
                        booking_id=new_booking.id,
                        time_slot_id=new_slot.id
                    )
                    db.add(booking_slot)
                    booking_slots_created += 1
            
            bookings_created += 1
        
        db.commit()
        print(f"   ✅ Создано {bookings_created} новых записей")
        print(f"   ✅ Создано {booking_slots_created} связей booking-time_slot")
        
        # 7. Генерируем дополнительные слоты
        print("7️⃣ Генерируем дополнительные слоты...")
        generate_additional_slots(db)
        
        print("🎉 Миграция завершена успешно!")
        
    except Exception as e:
        print(f"❌ Ошибка при миграции: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def generate_additional_slots(db: Session):
    """Генерация дополнительных слотов на основе расписания"""
    schedules = db.query(models.WorkSchedule).all()
    slots_created = 0
    
    # Генерируем слоты на следующие 4 недели
    start_date = date.today() + timedelta(weeks=1)
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
    print(f"   ✅ Создано {slots_created} дополнительных слотов")


if __name__ == "__main__":
    migrate_existing_database()
