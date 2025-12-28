import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, time

from app.db import Base, get_db
from app import models, schemas # Keep models and schemas imported at module level
from app.deps import get_current_user




# Настройка тестовой базы данных
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def db_engine():
    """Returns an engine for the test database."""
    return create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


@pytest.fixture(scope="session")
def setup_db(db_engine):
    """Creates the database schema once per session."""
    Base.metadata.create_all(bind=db_engine)
    yield
    Base.metadata.drop_all(bind=db_engine)


@pytest.fixture(scope="function")
def db_session(db_engine, setup_db):
    """Provides a transactional scope for tests."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(autocommit=False, autoflush=False, bind=connection)()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def test_user_fixture(db_session):
    test_user = models.User(email="test@user.com", password_hash="hash", full_name="Test User")
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture(scope="function")
def test_client(db_session, test_user_fixture):
    """Фикстура для создания тестового клиента с очищенной БД и переопределенными зависимостями"""
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: test_user_fixture
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_db)
    app.dependency_overrides.pop(get_current_user)






def test_create_booking_capacity_limit(test_client, db_session, test_user_fixture):

    client = test_client

    # 1. Создаем тестовые данные

    test_object = models.Object(name="Test Object", object_type="warehouse", capacity_in=1, capacity_out=1)

    db_session.add(test_object)

    db_session.commit()



    test_dock = models.Dock(name="Test Dock", dock_type="entrance", object_id=test_object.id)

    db_session.add(test_dock)

    db_session.commit()



    test_vehicle_type = models.VehicleType(name="Test Vehicle", duration_minutes=30)

    db_session.add(test_vehicle_type)

    db_session.commit()



    test_slot = models.TimeSlot(

        dock_id=test_dock.id,

        slot_date=date.today(),

        start_time=time(10, 0),

        end_time=time(10, 30),

        capacity=1,

    )

    db_session.add(test_slot)

    db_session.commit()



    # 2. Создаем первое бронирование (должно пройти успешно)

    booking_data_1 = {

        "vehicle_type_id": test_vehicle_type.id,

        "booking_date": str(date.today()),

        "start_time": "10:00",

        "object_id": test_object.id,

        "vehicle_plate": "123",

        "driver_full_name": "driver",

        "driver_phone": "12345",

    }

    response1 = client.post("/api/bookings/", json=booking_data_1)

    assert response1.status_code == 200



    # 3. Создаем второе бронирование на тот же слот (должно провалиться из-за лимита)

    booking_data_2 = {

        "vehicle_type_id": test_vehicle_type.id,

        "booking_date": str(date.today()),

        "start_time": "10:00",

        "object_id": test_object.id,

        "vehicle_plate": "456",

        "driver_full_name": "driver2",

        "driver_phone": "54321",

    }

    response2 = client.post("/api/bookings/", json=booking_data_2)

    assert response2.status_code == 409

    assert "No available time slots found" in response2.json()["detail"]


def test_create_booking_on_exit_dock_fails(test_client, db_session):
    """
    Тест проверяет, что нельзя создать бронь на ВХОД для дока с типом "Выход".
    Ожидаемый результат: Ошибка 409, так как доступных слотов найдено не будет.
    """
    # 1. Arrange: Создаем тестовые данные
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    exit_dock = models.Dock(name="Exit Dock", dock_type="exit", object_id=test_object.id)
    db_session.add(exit_dock)
    db_session.commit()

    test_vehicle_type = models.VehicleType(name="Test Vehicle", duration_minutes=30)
    db_session.add(test_vehicle_type)
    db_session.commit()

    test_slot = models.TimeSlot(
        dock_id=exit_dock.id,
        slot_date=date.today(),
        start_time=time(14, 0),
        end_time=time(14, 30),
        capacity=1,
    )
    db_session.add(test_slot)
    db_session.commit()

    # 2. Act: Пытаемся создать бронирование на этот слот
    booking_data = {
        "vehicle_type_id": test_vehicle_type.id,
        "booking_date": str(date.today()),
        "start_time": "14:00",
        "object_id": test_object.id, # Важно указать объект
        "vehicle_plate": "EXIT-TEST",
        "driver_full_name": "Test Driver",
        "driver_phone": "1234567890",
    }

    response = test_client.post("/api/bookings/", json=booking_data)

    # 3. Assert: Проверяем, что получили ошибку
    assert response.status_code == 409
    assert "No available time slots found" in response.json()["detail"]




