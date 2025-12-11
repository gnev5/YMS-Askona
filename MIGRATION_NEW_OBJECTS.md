# Миграция новых объектов в YMS

## Описание изменений

Добавлены новые справочники и поля в существующие объекты:

### Новые справочники:
1. **Типы перевозки** (`transport_types`)
   - собственное производство
   - закупная
   - контейнер
   - возврат

2. **Зоны** (`zones`)
   - Эрго/решетки/корпус
   - Кровати/Диваны
   - Аксессуары/матрасы
   - Закупка Импорт

3. **Поставщики** (`suppliers`)
   - Название (100 символов)
   - Комментарий (255 символов)
   - Связь с зоной

### Обновленные объекты:

#### Доки (`docks`)
- `dock_type` - тип дока (универсальный, вход, выход)
- `zone_id` - связь с зоной

#### Записи (`bookings`)
- `supplier_id` - связь с поставщиком
- `zone_id` - связь с зоной
- `transport_type_id` - связь с типом перевозки
- `cubes` - кубы (число с плавающей точкой)
- `transport_sheet` - транспортный лист (20 символов)

#### Пользователи
- Связь многие-ко-многим с поставщиками через таблицу `user_suppliers`

## Инструкция по применению миграции

### 1. Остановите приложение
```bash
# Остановите backend и frontend
```

### 2. Выполните миграцию базы данных
```bash
cd backend
python migrate_new_objects.py
```

### 3. Заполните начальные данные
```bash
python seed_new_data.py
```

### 4. Запустите приложение
```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm run dev
```

## Новые API эндпоинты

### Типы перевозки
- `GET /api/transport-types/` - получить все типы
- `POST /api/transport-types/` - создать тип (только админ)
- `PUT /api/transport-types/{id}` - обновить тип (только админ)
- `DELETE /api/transport-types/{id}` - удалить тип (только админ)

### Зоны
- `GET /api/zones/` - получить все зоны
- `POST /api/zones/` - создать зону (только админ)
- `PUT /api/zones/{id}` - обновить зону (только админ)
- `DELETE /api/zones/{id}` - удалить зону (только админ)

### Поставщики
- `GET /api/suppliers/` - получить всех поставщиков
- `POST /api/suppliers/` - создать поставщика (только админ)
- `PUT /api/suppliers/{id}` - обновить поставщика (только админ)
- `DELETE /api/suppliers/{id}` - удалить поставщика (только админ)
- `GET /api/suppliers/user/{user_id}` - получить поставщиков пользователя
- `POST /api/suppliers/user/{user_id}/supplier/{supplier_id}` - добавить связь
- `DELETE /api/suppliers/user/{user_id}/supplier/{supplier_id}` - удалить связь

## Новые страницы в админке

1. **Управление зонами** - `/admin-zones`
2. **Управление поставщиками** - `/admin-suppliers`
3. **Управление типами перевозки** - `/admin-transport-types`

## Обновленное модальное окно бронирования

Добавлены новые поля:
- Поставщик (выпадающий список)
- Зона (выпадающий список)
- Тип перевозки (выпадающий список)
- Кубы (числовое поле)
- Транспортный лист (текстовое поле)

## Проверка миграции

После применения миграции проверьте:

1. ✅ Новые таблицы созданы в базе данных
2. ✅ Начальные данные загружены
3. ✅ API эндпоинты работают
4. ✅ Новые страницы доступны в админке
5. ✅ Модальное окно бронирования содержит новые поля
6. ✅ Существующие доки получили тип "универсальный"

## Откат миграции

Если необходимо откатить изменения:

```sql
-- Удалить новые таблицы
DROP TABLE IF EXISTS user_suppliers;
DROP TABLE IF EXISTS user_supplier_relations;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS zones;
DROP TABLE IF EXISTS transport_types;

-- Удалить новые колонки из bookings
ALTER TABLE bookings DROP COLUMN IF EXISTS supplier_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS zone_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS transport_type_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS cubes;
ALTER TABLE bookings DROP COLUMN IF EXISTS transport_sheet;

-- Удалить новые колонки из docks
ALTER TABLE docks DROP COLUMN IF EXISTS dock_type;
ALTER TABLE docks DROP COLUMN IF EXISTS zone_id;
```
