from sqlalchemy.orm import Session
from datetime import time
from .db import SessionLocal, engine, Base
from . import models
from .security import get_password_hash


def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # Seed admin user
        admin_email = "admin@yms.local"
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin:
            db.add(models.User(
                email=admin_email,
                full_name="YMS Admin",
                password_hash=get_password_hash("Admin1234!"),
                role=models.UserRole.admin,
            ))

        # Seed docks
        default_docks = [
            {"name": "Dock 1", "status": models.DockStatus.active},
            {"name": "Dock 2", "status": models.DockStatus.active},
            {"name": "Dock 3", "status": models.DockStatus.maintenance},
        ]
        dock_ids = []
        for d in default_docks:
            exists = db.query(models.Dock).filter(models.Dock.name == d["name"]).first()
            if not exists:
                dock = models.Dock(name=d["name"], status=d["status"])
                db.add(dock)
                db.flush()  # Get the ID
                dock_ids.append(dock.id)
            else:
                dock_ids.append(exists.id)

        # Seed vehicle types
        default_vehicle_types = [
            {"name": "Фура 20т", "duration_minutes": 120},
            {"name": "Газель", "duration_minutes": 60},
            {"name": "Цистерна", "duration_minutes": 90},
        ]
        for vt in default_vehicle_types:
            exists = db.query(models.VehicleType).filter(models.VehicleType.name == vt["name"]).first()
            if not exists:
                db.add(models.VehicleType(name=vt["name"], duration_minutes=vt["duration_minutes"]))

        # Seed default schedules for each dock
        for dock_id in dock_ids:
            for dow in range(7):
                exists = db.query(models.WorkSchedule).filter(
                    models.WorkSchedule.day_of_week == dow,
                    models.WorkSchedule.dock_id == dock_id
                ).first()
                if not exists:
                    if dow < 5:  # Monday to Friday
                        db.add(models.WorkSchedule(
                            day_of_week=dow,
                            dock_id=dock_id,
                            work_start=time(9, 0),
                            work_end=time(18, 0),
                            break_start=time(13, 0),
                            break_end=time(14, 0),
                            is_working_day=True,
                            capacity=2,
                        ))
                    else:  # Weekend
                        db.add(models.WorkSchedule(
                            day_of_week=dow,
                            dock_id=dock_id,
                            is_working_day=False,
                            capacity=0,
                        ))

        db.commit()

        # Generate time slots
        db.query(models.TimeSlot).delete()
        schedules = db.query(models.WorkSchedule).all()
        from datetime import datetime, date, timedelta
        for ws in schedules:
            if not ws.is_working_day or ws.work_start is None or ws.work_end is None:
                continue
            current = ws.work_start
            while current < ws.work_end:
                next_time = (datetime.combine(date.today(), current) + timedelta(minutes=30)).time()
                if ws.break_start and ws.break_end and current < ws.break_end and next_time > ws.break_start:
                    current = ws.break_end
                    continue
                db.add(models.TimeSlot(
                    day_of_week=ws.day_of_week, 
                    dock_id=ws.dock_id,
                    start_time=current, 
                    end_time=next_time, 
                    capacity=ws.capacity
                ))
                current = next_time
        db.commit()

        print("Seed completed")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
