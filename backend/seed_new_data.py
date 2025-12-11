#!/usr/bin/env python3
"""
Скрипт для заполнения новых справочников начальными данными
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import TransportTypeRef, Zone, Supplier, TransportType, DockType
from app.security import get_password_hash

def seed_data():
    db = SessionLocal()
    
    try:
        # 1. Заполняем справочник типов перевозки
        print("Заполняем справочник типов перевозки...")
        transport_types_data = [
            {"name": "собственное производство", "enum_value": TransportType.own_production},
            {"name": "закупная", "enum_value": TransportType.purchased},
            {"name": "контейнер", "enum_value": TransportType.container},
            {"name": "возврат", "enum_value": TransportType.return_goods},
        ]
        
        for data in transport_types_data:
            existing = db.query(TransportTypeRef).filter(TransportTypeRef.name == data["name"]).first()
            if not existing:
                transport_type = TransportTypeRef(**data)
                db.add(transport_type)
                print(f"  - Добавлен тип перевозки: {data['name']}")
            else:
                print(f"  - Тип перевозки уже существует: {data['name']}")
        
        # 2. Заполняем справочник зон
        print("\nЗаполняем справочник зон...")
        zones_data = [
            {"name": "Эрго/решетки/корпус"},
            {"name": "Кровати/Диваны"},
            {"name": "Аксессуары/матрасы"},
            {"name": "Закупка Импорт"},
        ]
        
        for data in zones_data:
            existing = db.query(Zone).filter(Zone.name == data["name"]).first()
            if not existing:
                zone = Zone(**data)
                db.add(zone)
                print(f"  - Добавлена зона: {data['name']}")
            else:
                print(f"  - Зона уже существует: {data['name']}")
        
        # Сохраняем зоны перед созданием поставщиков
        db.commit()
        
        # 3. Заполняем справочник поставщиков
        print("\nЗаполняем справочник поставщиков...")
        
        # Получаем зоны для привязки поставщиков
        zones = db.query(Zone).all()
        if not zones:
            print("  - Ошибка: зоны не найдены. Сначала заполните зоны.")
            return
        
        suppliers_data = [
            {"name": "ООО 'Мебель Про'", "comment": "Основной поставщик мебели", "zone_id": zones[0].id},
            {"name": "ИП Иванов И.И.", "comment": "Поставщик аксессуаров", "zone_id": zones[2].id},
            {"name": "ЗАО 'Импорт Трейд'", "comment": "Импортные поставщики", "zone_id": zones[3].id},
            {"name": "ООО 'Кровати Плюс'", "comment": "Специализация на кроватях", "zone_id": zones[1].id},
            {"name": "ИП Петров П.П.", "comment": "Мелкий поставщик", "zone_id": zones[0].id},
        ]
        
        for data in suppliers_data:
            existing = db.query(Supplier).filter(Supplier.name == data["name"]).first()
            if not existing:
                supplier = Supplier(**data)
                db.add(supplier)
                print(f"  - Добавлен поставщик: {data['name']}")
            else:
                print(f"  - Поставщик уже существует: {data['name']}")
        
        # 4. Обновляем существующие доки (добавляем тип "Универсальный")
        print("\nОбновляем существующие доки...")
        from app.models import Dock
        
        docks = db.query(Dock).all()
        for dock in docks:
            if not hasattr(dock, 'dock_type') or dock.dock_type is None:
                dock.dock_type = DockType.universal
                print(f"  - Обновлен док: {dock.name} -> тип: универсальный")
        
        db.commit()
        print("\n✅ Все данные успешно заполнены!")
        
    except Exception as e:
        print(f"❌ Ошибка при заполнении данных: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
