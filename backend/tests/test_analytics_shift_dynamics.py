from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base, get_db
from app.deps import get_current_user


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def db_engine():
    return create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


@pytest.fixture(scope="session")
def setup_db(db_engine):
    Base.metadata.create_all(bind=db_engine)
    yield
    Base.metadata.drop_all(bind=db_engine)


@pytest.fixture(scope="function")
def db_session(db_engine, setup_db):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(autocommit=False, autoflush=False, bind=connection)()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def admin_user(db_session):
    user = models.User(
        email="analytics-admin@example.com",
        password_hash="hash",
        full_name="Analytics Admin",
        role=models.UserRole.admin,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_client(db_session, admin_user):
    import app.db as app_db
    app_db.engine = db_session.get_bind()

    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: admin_user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_db)
    app.dependency_overrides.pop(get_current_user)


def add_booking_with_slot(
    db_session,
    *,
    user_id: int,
    dock_id: int,
    vehicle_type_id: int,
    slot_date: date,
    start_time: time,
    end_time: time,
    cubes: float,
    status: str = "confirmed",
):
    slot = models.TimeSlot(
        dock_id=dock_id,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        capacity=1,
    )
    booking = models.Booking(
        user_id=user_id,
        vehicle_type_id=vehicle_type_id,
        vehicle_plate="A123AA",
        driver_full_name="Driver",
        driver_phone="+70000000000",
        cubes=cubes,
        status=status,
    )
    db_session.add_all([slot, booking])
    db_session.flush()
    db_session.add(models.BookingTimeSlot(booking_id=booking.id, time_slot_id=slot.id))
    db_session.commit()
    return booking


def test_shift_dynamics_groups_planned_booking_start_by_day_and_night_shifts(test_client, db_session, admin_user):
    test_object = models.Object(name="Test Object", object_type=models.ObjectType.warehouse)
    dock = models.Dock(name="Dock 1", dock_type=models.DockType.entrance, object=test_object)
    vehicle_type = models.VehicleType(name="Truck", duration_minutes=30)
    db_session.add_all([test_object, dock, vehicle_type])
    db_session.commit()

    # Day shift for 2026-07-05: 08:00 <= planned start < 20:00.
    add_booking_with_slot(
        db_session,
        user_id=admin_user.id,
        dock_id=dock.id,
        vehicle_type_id=vehicle_type.id,
        slot_date=date(2026, 7, 5),
        start_time=time(8, 0),
        end_time=time(8, 30),
        cubes=10,
    )
    add_booking_with_slot(
        db_session,
        user_id=admin_user.id,
        dock_id=dock.id,
        vehicle_type_id=vehicle_type.id,
        slot_date=date(2026, 7, 5),
        start_time=time(19, 59),
        end_time=time(20, 0),
        cubes=20,
    )

    # Night shift for 2026-07-05 starts at 20:00 and includes next-day early morning.
    add_booking_with_slot(
        db_session,
        user_id=admin_user.id,
        dock_id=dock.id,
        vehicle_type_id=vehicle_type.id,
        slot_date=date(2026, 7, 5),
        start_time=time(20, 0),
        end_time=time(20, 30),
        cubes=30,
    )
    add_booking_with_slot(
        db_session,
        user_id=admin_user.id,
        dock_id=dock.id,
        vehicle_type_id=vehicle_type.id,
        slot_date=date(2026, 7, 6),
        start_time=time(3, 0),
        end_time=time(3, 30),
        cubes=40,
    )

    # 08:00 on the next day is not part of the previous night shift.
    add_booking_with_slot(
        db_session,
        user_id=admin_user.id,
        dock_id=dock.id,
        vehicle_type_id=vehicle_type.id,
        slot_date=date(2026, 7, 6),
        start_time=time(8, 0),
        end_time=time(8, 30),
        cubes=50,
    )

    # Cancelled bookings must follow the same exclusion rule as the other analytics dashboards.
    add_booking_with_slot(
        db_session,
        user_id=admin_user.id,
        dock_id=dock.id,
        vehicle_type_id=vehicle_type.id,
        slot_date=date(2026, 7, 5),
        start_time=time(10, 0),
        end_time=time(10, 30),
        cubes=999,
        status="cancelled",
    )

    response = test_client.get(
        "/api/analytics/shift-dynamics",
        params={"start_date": "2026-07-05", "end_date": "2026-07-05"},
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "shift_date": "2026-07-05",
            "shift_1": {
                "label": "Смена 1",
                "start_time": "08:00",
                "end_time": "20:00",
                "count": 2,
                "cubes": 30.0,
            },
            "shift_2": {
                "label": "Смена 2",
                "start_time": "20:00",
                "end_time": "08:00",
                "count": 2,
                "cubes": 70.0,
            },
        }
    ]


def test_shift_dynamics_returns_zero_points_for_dates_without_bookings(test_client):
    response = test_client.get(
        "/api/analytics/shift-dynamics",
        params={"start_date": "2026-07-01", "end_date": "2026-07-02"},
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "shift_date": "2026-07-01",
            "shift_1": {"label": "Смена 1", "start_time": "08:00", "end_time": "20:00", "count": 0, "cubes": 0.0},
            "shift_2": {"label": "Смена 2", "start_time": "20:00", "end_time": "08:00", "count": 0, "cubes": 0.0},
        },
        {
            "shift_date": "2026-07-02",
            "shift_1": {"label": "Смена 1", "start_time": "08:00", "end_time": "20:00", "count": 0, "cubes": 0.0},
            "shift_2": {"label": "Смена 2", "start_time": "20:00", "end_time": "08:00", "count": 0, "cubes": 0.0},
        },
    ]
