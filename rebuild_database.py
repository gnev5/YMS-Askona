#!/usr/bin/env python3
"""
Скрипт для полной пересборки базы данных с новой структурой
"""
import subprocess
import sys
import time

def run_command(command, description):
    """Выполнить команду и показать результат"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} - успешно")
        if result.stdout:
            print(f"   Вывод: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - ошибка")
        print(f"   Код ошибки: {e.returncode}")
        if e.stdout:
            print(f"   Вывод: {e.stdout.strip()}")
        if e.stderr:
            print(f"   Ошибка: {e.stderr.strip()}")
        return False

def main():
    print("🚀 Начинаем полную пересборку базы данных...")
    
    # Шаг 1: Остановить сервисы
    if not run_command("docker compose down", "Остановка сервисов"):
        print("⚠️ Не удалось остановить сервисы, продолжаем...")
    
    # Шаг 2: Удалить том с данными
    if not run_command("docker volume rm yms-askona_db_data", "Удаление старого тома БД"):
        print("⚠️ Том БД не найден или уже удален, продолжаем...")
    
    # Шаг 3: Запустить сервисы
    if not run_command("docker compose up -d", "Запуск сервисов"):
        print("❌ Не удалось запустить сервисы")
        sys.exit(1)
    
    # Шаг 4: Подождать, пока БД запустится
    print("⏳ Ожидание запуска базы данных...")
    time.sleep(10)
    
    # Шаг 5: Выполнить миграцию
    if not run_command("docker compose exec backend python -m app.migrate_database", "Выполнение миграции БД"):
        print("❌ Не удалось выполнить миграцию")
        sys.exit(1)
    
    # Шаг 6: Заполнить начальными данными
    if not run_command("docker compose exec backend python -m app.seed", "Заполнение начальными данными"):
        print("❌ Не удалось заполнить начальными данными")
        sys.exit(1)
    
    # Шаг 7: Проверить результат
    print("🔍 Проверка результата...")
    run_command("docker compose exec db psql -U yms -d yms -c \"\\d time_slots\"", "Структура таблицы time_slots")
    run_command("docker compose exec db psql -U yms -d yms -c \"SELECT COUNT(*) FROM time_slots;\"", "Количество слотов")
    run_command("docker compose exec db psql -U yms -d yms -c \"SELECT COUNT(*) FROM bookings;\"", "Количество записей")
    
    print("🎉 Пересборка базы данных завершена успешно!")
    print("🌐 Фронтенд: http://localhost:5173")
    print("📚 API документация: http://localhost:8000/docs")

if __name__ == "__main__":
    main()
