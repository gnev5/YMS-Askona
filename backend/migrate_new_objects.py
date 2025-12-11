#!/usr/bin/env python3
"""
Миграция для добавления новых объектов и полей
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal, engine
from sqlalchemy import text

def migrate_database():
    """Выполняет миграцию базы данных"""
    db = SessionLocal()
    
    try:
        print("🔄 Начинаем миграцию базы данных...")
        
        # 1. Создаем таблицу transport_types
        print("1. Создаем таблицу transport_types...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS transport_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                enum_value VARCHAR(50) NOT NULL
            )
        """))
        
        # 2. Создаем таблицу zones
        print("2. Создаем таблицу zones...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS zones (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL
            )
        """))
        
        # 3. Создаем таблицу suppliers
        print("3. Создаем таблицу suppliers...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                comment TEXT,
                zone_id INTEGER REFERENCES zones(id)
            )
        """))
        
        # 4. Создаем таблицу user_suppliers (связь многие-ко-многим)
        print("4. Создаем таблицу user_suppliers...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS user_suppliers (
                user_id INTEGER REFERENCES users(id),
                supplier_id INTEGER REFERENCES suppliers(id),
                PRIMARY KEY (user_id, supplier_id)
            )
        """))
        
        # 5. Создаем таблицу user_supplier_relations
        print("5. Создаем таблицу user_supplier_relations...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS user_supplier_relations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) NOT NULL,
                supplier_id INTEGER REFERENCES suppliers(id) NOT NULL,
                UNIQUE(user_id, supplier_id)
            )
        """))
        
        # 6. Добавляем новые поля в таблицу docks
        print("6. Добавляем новые поля в таблицу docks...")
        
        # Проверяем, существует ли колонка dock_type
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'docks' AND column_name = 'dock_type'
        """)).fetchone()
        
        if not result:
            db.execute(text("""
                ALTER TABLE docks 
                ADD COLUMN dock_type VARCHAR(20) DEFAULT 'universal' NOT NULL
            """))
            print("  - Добавлена колонка dock_type")
        else:
            print("  - Колонка dock_type уже существует")
        
        # Проверяем, существует ли колонка zone_id
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'docks' AND column_name = 'zone_id'
        """)).fetchone()
        
        if not result:
            db.execute(text("""
                ALTER TABLE docks 
                ADD COLUMN zone_id INTEGER REFERENCES zones(id)
            """))
            print("  - Добавлена колонка zone_id")
        else:
            print("  - Колонка zone_id уже существует")
        
        # 7. Добавляем новые поля в таблицу bookings
        print("7. Добавляем новые поля в таблицу bookings...")
        
        new_columns = [
            ("supplier_id", "INTEGER REFERENCES suppliers(id)"),
            ("zone_id", "INTEGER REFERENCES zones(id)"),
            ("transport_type_id", "INTEGER REFERENCES transport_types(id)"),
            ("cubes", "FLOAT"),
            ("transport_sheet", "VARCHAR(20)")
        ]
        
        for column_name, column_type in new_columns:
            result = db.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'bookings' AND column_name = '{column_name}'
            """)).fetchone()
            
            if not result:
                db.execute(text(f"""
                    ALTER TABLE bookings 
                    ADD COLUMN {column_name} {column_type}
                """))
                print(f"  - Добавлена колонка {column_name}")
            else:
                print(f"  - Колонка {column_name} уже существует")
        
        # 8. Создаем индексы для производительности
        print("8. Создаем индексы...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_docks_zone_id ON docks(zone_id)",
            "CREATE INDEX IF NOT EXISTS idx_docks_dock_type ON docks(dock_type)",
            "CREATE INDEX IF NOT EXISTS idx_suppliers_zone_id ON suppliers(zone_id)",
            "CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id ON bookings(supplier_id)",
            "CREATE INDEX IF NOT EXISTS idx_bookings_zone_id ON bookings(zone_id)",
            "CREATE INDEX IF NOT EXISTS idx_bookings_transport_type_id ON bookings(transport_type_id)",
        ]
        
        for index_sql in indexes:
            try:
                db.execute(text(index_sql))
                print(f"  - Создан индекс: {index_sql.split()[-1]}")
            except Exception as e:
                print(f"  - Индекс уже существует или ошибка: {e}")
        
        db.commit()
        print("\n✅ Миграция успешно завершена!")
        
    except Exception as e:
        print(f"❌ Ошибка при миграции: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_database()
