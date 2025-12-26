#!/usr/bin/env python3
"""
Скрипт для восстановления базы данных из резервной копии
"""
import subprocess
import sys
import os
import glob
from pathlib import Path

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

def list_backup_files():
    """Показать доступные файлы резервных копий"""
    backup_dir = "backups"
    if not os.path.exists(backup_dir):
        print(f"❌ Директория {backup_dir} не найдена")
        return []

    # Ищем все .sql файлы
    sql_files = glob.glob(os.path.join(backup_dir, "*.sql"))
    sql_files.sort(reverse=True)  # Новые файлы первыми

    if not sql_files:
        print(f"❌ Файлы резервных копий не найдены в директории {backup_dir}")
        return []

    print("📁 Доступные резервные копии:")
    for i, file_path in enumerate(sql_files[:10], 1):  # Показываем последние 10
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)
        print(f"   {i}. {file_name} ({file_size_mb:.2f} МБ)")

    return sql_files

def main():
    print("🔄 Восстановление базы данных из резервной копии")
    print("⚠️  ВНИМАНИЕ! Все текущие данные будут заменены!")
    print()

    # Показать доступные бэкапы
    backup_files = list_backup_files()
    if not backup_files:
        sys.exit(1)

    print()
    # Запрос выбора файла
    while True:
        choice = input("Введите номер файла для восстановления (или 'q' для выхода): ").strip()
        if choice.lower() == 'q':
            print("❌ Отменено пользователем")
            sys.exit(0)

        try:
            index = int(choice) - 1
            if 0 <= index < len(backup_files):
                selected_file = backup_files[index]
                break
            else:
                print(f"❌ Неверный номер. Введите число от 1 до {len(backup_files)}")
        except ValueError:
            print("❌ Введите число или 'q' для выхода")

    print(f"📁 Выбран файл: {os.path.basename(selected_file)}")
    print()

    # Подтверждение
    confirm = input("Вы уверены? Все текущие данные будут потеряны (yes/no): ").strip().lower()
    if confirm != "yes":
        print("❌ Отменено пользователем")
        sys.exit(0)

    print()

    # Проверка, что контейнер БД запущен
    check_cmd = "docker compose ps db"
    if not run_command(check_cmd, "Проверка состояния контейнера БД"):
        print("❌ Контейнер БД не запущен. Запустите его командой: docker compose up -d")
        sys.exit(1)

    # Проверка, является ли файл сжатым
    if selected_file.endswith('.gz'):
        print("📦 Распаковка сжатого файла...")
        uncompressed_file = selected_file[:-3]  # Убираем .gz
        gunzip_cmd = f"gunzip -k {selected_file}"
        if not run_command(gunzip_cmd, "Распаковка файла"):
            sys.exit(1)
        selected_file = uncompressed_file

    # Восстановление БД
    restore_cmd = f"docker compose exec -T db psql -U yms -d yms < {selected_file}"
    if not run_command(restore_cmd, "Восстановление базы данных"):
        print("❌ Не удалось восстановить базу данных")
        sys.exit(1)

    print()
    print("🎉 База данных восстановлена успешно!")
    print()
    print("🔍 Проверка восстановления:")
    run_command("docker compose exec db psql -U yms -d yms -c \"SELECT COUNT(*) FROM users;\"", "Количество пользователей")
    run_command("docker compose exec db psql -U yms -d yms -c \"SELECT COUNT(*) FROM bookings;\"", "Количество бронирований")

if __name__ == "__main__":
    main()