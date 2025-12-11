from app.db import SessionLocal
from app import models

def check_data():
    db = SessionLocal()
    try:
        print("=== Checking Database Data ===")
        
        # Check docks
        docks = db.query(models.Dock).all()
        print(f"Docks: {len(docks)}")
        for dock in docks:
            print(f"  - {dock.name} (ID: {dock.id})")
        
        # Check work schedules
        schedules = db.query(models.WorkSchedule).all()
        print(f"Work Schedules: {len(schedules)}")
        for schedule in schedules:
            print(f"  - Day {schedule.day_of_week}, Dock {schedule.dock_id}, Working: {schedule.is_working_day}")
        
        # Check time slots
        slots = db.query(models.TimeSlot).all()
        print(f"Time Slots: {len(slots)}")
        for slot in slots[:5]:  # Show first 5
            print(f"  - Day {slot.day_of_week}, Dock {slot.dock_id}, {slot.start_time}-{slot.end_time}")
        
        # Check vehicle types
        vtypes = db.query(models.VehicleType).all()
        print(f"Vehicle Types: {len(vtypes)}")
        for vtype in vtypes:
            print(f"  - {vtype.name} ({vtype.duration_minutes} min)")
        
        # Check users
        users = db.query(models.User).all()
        print(f"Users: {len(users)}")
        for user in users:
            print(f"  - {user.email} ({user.role})")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
