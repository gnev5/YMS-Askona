#!/usr/bin/env python3
"""
Скрипт для создания резервной копии базы данных
"""
import subprocess
import sys
from datetime import datetime
import os

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
    print("💾 Создание резервной копии базы данных...")
    print()

    # Создать директорию для бэкапов
    backup_dir = "backups"
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        print(f"📁 Создана директория: {backup_dir}")

    # Генерация имени файла с датой и временем
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"yms_backup_{timestamp}.sql")

    print(f"📝 Файл резервной копии: {backup_file}")
    print()

    # Проверка, что контейнер БД запущен
    check_cmd = "docker compose ps db"
    if not run_command(check_cmd, "Проверка состояния контейнера БД"):
        print("❌ Контейнер БД не запущен. Запустите его командой: docker compose up -d")
        sys.exit(1)

    # Создание дампа БД
    dump_cmd = f"docker compose exec -T db pg_dump -U yms -d yms > {backup_file}"
    if not run_command(dump_cmd, "Создание дампа базы данных"):
        print("❌ Не удалось создать резервную копию")
        sys.exit(1)

    # Проверка размера файла
    if os.path.exists(backup_file):
        file_size = os.path.getsize(backup_file)
        file_size_mb = file_size / (1024 * 1024)
        print(f"📊 Размер резервной копии: {file_size_mb:.2f} МБ")

    # Дополнительно создаем сжатую копию
    compressed_file = f"{backup_file}.gz"
    compress_cmd = f"gzip -k {backup_file}"
    if run_command(compress_cmd, "Сжатие резервной копии"):
        if os.path.exists(compressed_file):
            compressed_size = os.path.getsize(compressed_file)
            compressed_size_mb = compressed_size / (1024 * 1024)
            print(f"📦 Размер сжатой копии: {compressed_size_mb:.2f} МБ")

    print()
    print("🎉 Резервная копия создана успешно!")
    print(f"📁 Файлы:")
    print(f"   - {backup_file}")
    if os.path.exists(compressed_file):
        print(f"   - {compressed_file}")
    print()
    print("💡 Для восстановления используйте: python restore_database.py")

if __name__ == "__main__":
    main()
