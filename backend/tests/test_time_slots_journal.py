from datetime import date, time, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base, get_db
from app.deps import get_current_user


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"


def test_time_slots_journal_filters_by_weekday():
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(autocommit=False, autoflush=False, bind=connection)()

    try:
        admin_user = models.User(
            email="admin@example.com",
            password_hash="hash",
            full_name="Admin User",
            role=models.UserRole.admin,
        )
        session.add(admin_user)
        session.commit()
        session.refresh(admin_user)

        obj = models.Object(name="Weekday Object", object_type=models.ObjectType.warehouse)
        session.add(obj)
        session.commit()
        session.refresh(obj)

        dock = models.Dock(name="Weekday Dock", dock_type=models.DockType.entrance, object_id=obj.id)
        session.add(dock)
        session.commit()
        session.refresh(dock)

        base_date = date(2026, 6, 1)
        monday = base_date - timedelta(days=base_date.weekday())
        tuesday = monday + timedelta(days=1)

        session.add_all([
            models.TimeSlot(
                dock_id=dock.id,
                slot_date=monday,
                start_time=time(9, 0),
                end_time=time(9, 30),
                capacity=1,
                is_available=True,
            ),
            models.TimeSlot(
                dock_id=dock.id,
                slot_date=tuesday,
                start_time=time(9, 0),
                end_time=time(9, 30),
                capacity=1,
                is_available=True,
            ),
        ])
        session.commit()

        from app.main import app

        app.dependency_overrides[get_db] = lambda: session
        app.dependency_overrides[get_current_user] = lambda: admin_user

        with TestClient(app) as client:
            response = client.get(
                "/api/time-slots/journal",
                params={
                    "start_date": monday.isoformat(),
                    "end_date": tuesday.isoformat(),
                    "weekday": 0,
                },
            )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["slot_date"] == monday.isoformat()
        assert payload[0]["start_time"] == "09:00"
    finally:
        from app.main import app

        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        session.close()
        transaction.rollback()
        connection.close()
        Base.metadata.drop_all(bind=engine)
