from datetime import date, time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base, get_db
from app.deps import get_current_user


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"


def test_my_bookings_applies_date_filters_before_pagination():
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(autocommit=False, autoflush=False, bind=connection)()

    try:
        user = models.User(
            email="pager@example.com",
            password_hash="hash",
            full_name="Pager User",
            role=models.UserRole.carrier,
        )
        vehicle_type = models.VehicleType(name="Truck", duration_minutes=30)
        test_object = models.Object(name="Paged Object", object_type=models.ObjectType.warehouse)
        dock = models.Dock(name="Paged Dock", dock_type=models.DockType.entrance, object=test_object)
        session.add_all([user, vehicle_type, test_object, dock])
        session.commit()

        def add_booking(slot_date: date, start_hour: int) -> models.Booking:
            slot = models.TimeSlot(
                dock_id=dock.id,
                slot_date=slot_date,
                start_time=time(start_hour, 0),
                end_time=time(start_hour, 30),
                capacity=1,
                is_available=True,
            )
            booking = models.Booking(
                user_id=user.id,
                vehicle_type_id=vehicle_type.id,
                vehicle_plate=f"A{start_hour:03d}BC77",
                driver_full_name=f"Driver {start_hour}",
                driver_phone="79990000000",
                status="confirmed",
                booking_type=models.BookingDirection.inbound,
            )
            session.add_all([slot, booking])
            session.flush()
            session.add(models.BookingTimeSlot(booking_id=booking.id, time_slot_id=slot.id))
            return booking

        add_booking(date(2026, 6, 5), 9)
        add_booking(date(2026, 6, 6), 10)
        add_booking(date(2026, 6, 10), 11)
        session.commit()

        from app.main import app

        app.dependency_overrides[get_db] = lambda: session
        app.dependency_overrides[get_current_user] = lambda: user

        with TestClient(app) as client:
            response = client.get(
                "/api/bookings/my",
                params={
                    "date_from": "2026-06-05",
                    "date_to": "2026-06-06",
                    "page": 1,
                    "page_size": 1,
                },
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["total"] == 2
        assert payload["page"] == 1
        assert payload["page_size"] == 1
        assert payload["total_pages"] == 2
        assert len(payload["items"]) == 1
        assert payload["items"][0]["booking_date"] == "2026-06-06"
    finally:
        from app.main import app

        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        session.close()
        transaction.rollback()
        connection.close()
        Base.metadata.drop_all(bind=engine)
