#!/usr/bin/env python3
"""
Скрипт для тестирования миграции базы данных
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.migrate_data import migrate_data

if __name__ == "__main__":
    print("🧪 Тестируем миграцию базы данных...")
    try:
        migrate_data()
        print("✅ Миграция прошла успешно!")
    except Exception as e:
        print(f"❌ Ошибка при миграции: {e}")
        sys.exit(1)
