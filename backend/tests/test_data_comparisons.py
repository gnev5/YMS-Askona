from datetime import date, time
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
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
        email="comparison-admin@example.com",
        password_hash="hash",
        full_name="Comparison Admin",
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


def _xlsx_with_tl_numbers(*tl_numbers: str) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.append(["Номер ТЛ", "Комментарий"])
    for number in tl_numbers:
        ws.append([number, "test"])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _add_booking(db_session, *, user_id: int, object_id: int, direction: str, tl_number: str, slot_date: date):
    dock_type = models.DockType.entrance if direction == "in" else models.DockType.exit
    dock = models.Dock(name=f"Dock {tl_number}", dock_type=dock_type, object_id=object_id)
    vehicle_type = models.VehicleType(name=f"Truck {tl_number}", duration_minutes=30)
    db_session.add_all([dock, vehicle_type])
    db_session.flush()
    slot = models.TimeSlot(
        dock_id=dock.id,
        slot_date=slot_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        capacity=1,
    )
    booking = models.Booking(
        user_id=user_id,
        vehicle_type_id=vehicle_type.id,
        transport_sheet=tl_number,
        booking_type=models.BookingDirection(direction),
        status="confirmed",
    )
    db_session.add_all([slot, booking])
    db_session.flush()
    db_session.add(models.BookingTimeSlot(booking_id=booking.id, time_slot_id=slot.id))
    db_session.commit()
    return booking


def test_comparison_run_matches_tl_case_insensitive_and_checks_extended_period(test_client, db_session, admin_user):
    obj = models.Object(name="РЦ Тест", object_type=models.ObjectType.warehouse)
    db_session.add(obj)
    db_session.commit()

    _add_booking(db_session, user_id=admin_user.id, object_id=obj.id, direction="in", tl_number="TL-001", slot_date=date(2026, 7, 10))
    _add_booking(db_session, user_id=admin_user.id, object_id=obj.id, direction="in", tl_number="TL-002", slot_date=date(2026, 7, 12))
    _add_booking(db_session, user_id=admin_user.id, object_id=obj.id, direction="in", tl_number="TL-003", slot_date=date(2026, 7, 8))

    profile_response = test_client.post(
        "/api/data-comparisons/profiles",
        json={
            "name": "РЦ Тест — Вход",
            "object_id": obj.id,
            "direction": "in",
            "tl_column_name": "Номер ТЛ",
            "status_filters": ["confirmed"],
        },
    )
    assert profile_response.status_code == 200
    profile_id = profile_response.json()["id"]

    upload = _xlsx_with_tl_numbers(" tl-001 ", "TL-003", "TL-999", "TL-DUP", "tl-dup")
    response = test_client.post(
        "/api/data-comparisons/runs",
        data={"profile_id": str(profile_id), "date_from": "2026-07-10", "date_to": "2026-07-12"},
        files={"file": ("comparison.xlsx", upload, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {
        "file_rows": 5,
        "unique_file_tl": 4,
        "yms_rows": 2,
        "matched": 1,
        "found_in_yms_extended_period": 1,
        "missing_in_yms": 1,
        "missing_in_file": 1,
        "duplicate_in_file": 2,
        "duplicate_in_yms": 0,
    }

    rows_by_tl = {row["tl_number_normalized"]: row for row in payload["rows"]}
    assert rows_by_tl["TL-001"]["status"] == "matched"
    assert rows_by_tl["TL-003"]["status"] == "found_in_yms_extended_period"
    assert rows_by_tl["TL-999"]["status"] == "missing_in_yms"
    assert rows_by_tl["TL-002"]["status"] == "missing_in_file"
    duplicate_rows = [row for row in payload["rows"] if row["status"] == "duplicate_in_file"]
    assert len(duplicate_rows) == 2

    history = test_client.get("/api/data-comparisons/runs")
    assert history.status_code == 200
    assert history.json()[0]["summary"]["found_in_yms_extended_period"] == 1

    detail = test_client.get(f"/api/data-comparisons/runs/{payload['id']}")
    assert detail.status_code == 200
    assert detail.json()["rows"] == payload["rows"]
