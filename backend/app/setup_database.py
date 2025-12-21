
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import time, datetime, date, timedelta

from .db import SessionLocal, engine, Base
from . import models
from .security import get_password_hash
from .models import TransportType, DockType, ObjectType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_schema(db: Session):
    """Creates the full database schema."""
    logger.info("Creating all tables from Base metadata...")
    Base.metadata.create_all(bind=engine)
    logger.info("Tables from metadata created.")


def create_admin_user(db: Session):
    """Creates the default admin user if it doesn't exist."""
    admin_email = "admin@yms.local"
    admin = db.query(models.User).filter(models.User.email == admin_email).first()
    if not admin:
        db.add(models.User(
            email=admin_email,
            full_name="YMS Admin",
            password_hash=get_password_hash("Admin1234!"),
            role=models.UserRole.admin,
        ))
        logger.info("Admin user created.")
    else:
        logger.info("Admin user already exists.")

def seed_initial_data(db: Session):
    """Seeds the database with initial data."""
    # Seed objects
    logger.info("Seeding objects...")
    obukhovo = db.query(models.Object).filter(models.Object.name == "Обухово").first()
    if not obukhovo:
        obukhovo = models.Object(name="Обухово", object_type=ObjectType.warehouse, address="142440, МО, Ногинский р-н, п. Обухово, Кудиновское ш., д. 4")
        db.add(obukhovo)
        db.flush()
    
    akson = db.query(models.Object).filter(models.Object.name == "Аксон").first()
    if not akson:
        akson = models.Object(name="Аксон", object_type=ObjectType.warehouse, address="Ногинский р-н, п. Аксено-Бутырское")
        db.add(akson)
        db.flush()

    # Seed docks
    logger.info("Seeding docks...")
    default_docks = [
        {"name": "Dock 1", "status": models.DockStatus.active, "dock_type": DockType.universal},
        {"name": "Dock 2", "status": models.DockStatus.active, "dock_type": DockType.universal},
        {"name": "Dock 3", "status": models.DockStatus.maintenance, "dock_type": DockType.universal},
    ]
    dock_ids = []
    for d in default_docks:
        exists = db.query(models.Dock).filter(models.Dock.name == d["name"]).first()
        if not exists:
            dock = models.Dock(name=d["name"], status=d["status"], dock_type=d["dock_type"], object_id=obukhovo.id)
            db.add(dock)
            db.flush()
            dock_ids.append(dock.id)
        else:
            dock_ids.append(exists.id)
    logger.info("Docks seeded.")

    # Seed vehicle types
    logger.info("Seeding vehicle types...")
    default_vehicle_types = [
        {"name": "Фура 20т", "duration_minutes": 120},
        {"name": "Газель", "duration_minutes": 60},
        {"name": "Цистерна", "duration_minutes": 90},
    ]
    for vt in default_vehicle_types:
        exists = db.query(models.VehicleType).filter(models.VehicleType.name == vt["name"]).first()
        if not exists:
            db.add(models.VehicleType(name=vt["name"], duration_minutes=vt["duration_minutes"]))
    logger.info("Vehicle types seeded.")

    # Seed transport types
    logger.info("Seeding transport types...")
    transport_types_data = [
        {"name": "собственное производство", "enum_value": TransportType.own_production},
        {"name": "закупная", "enum_value": TransportType.purchased},
        {"name": "контейнер", "enum_value": TransportType.container},
        {"name": "возврат", "enum_value": TransportType.return_goods},
    ]
    for data in transport_types_data:
        existing = db.query(models.TransportTypeRef).filter(models.TransportTypeRef.name == data["name"]).first()
        if not existing:
            transport_type = models.TransportTypeRef(**data)
            db.add(transport_type)
    logger.info("Transport types seeded.")

    # Seed zones
    logger.info("Seeding zones...")
    zones_data = [
        {"name": "Эрго/решетки/корпус"},
        {"name": "Кровати/Диваны"},
        {"name": "Аксессуары/матрасы"},
        {"name": "Закупка Импорт"},
    ]
    zone_map = {}
    for data in zones_data:
        existing = db.query(models.Zone).filter(models.Zone.name == data["name"]).first()
        if not existing:
            zone = models.Zone(**data)
            db.add(zone)
            db.flush()
            zone_map[data["name"]] = zone.id
        else:
            zone_map[data["name"]] = existing.id
    logger.info("Zones seeded.")

    # Seed suppliers
    logger.info("Seeding suppliers...")
    suppliers_data = [
        {"name": "Аскона", "comment": "Собственный поставщик", "zone_id": zone_map.get("Эрго/решетки/корпус")},
        {"name": "ООО 'Мебель Про'", "comment": "Основной поставщик мебели", "zone_id": zone_map.get("Эрго/решетки/корпус")},
        {"name": "ИП Иванов И.И.", "comment": "Поставщик аксессуаров", "zone_id": zone_map.get("Аксессуары/матрасы")},
        {"name": "ЗАО 'Импорт Трейд'", "comment": "Импортные поставщики", "zone_id": zone_map.get("Закупка Импорт")},
        {"name": "ООО 'Кровати Плюс'", "comment": "Специализация на кроватях", "zone_id": zone_map.get("Кровати/Диваны")},
    ]
    for data in suppliers_data:
        existing = db.query(models.Supplier).filter(models.Supplier.name == data["name"]).first()
        if not existing and data["zone_id"]:
            supplier = models.Supplier(**data)
            db.add(supplier)
    logger.info("Suppliers seeded.")

    # Seed default schedules for each dock
    logger.info("Seeding work schedules...")
    for dock_id in dock_ids:
        for dow in range(7):
            exists = db.query(models.WorkSchedule).filter_by(day_of_week=dow, dock_id=dock_id).first()
            if not exists:
                if dow < 5:  # Monday to Friday
                    db.add(models.WorkSchedule(
                        day_of_week=dow, dock_id=dock_id, work_start=time(9, 0), work_end=time(18, 0),
                        break_start=time(13, 0), break_end=time(14, 0), is_working_day=True, capacity=2,
                    ))
                else:  # Weekend
                    db.add(models.WorkSchedule(
                        day_of_week=dow, dock_id=dock_id, is_working_day=False, capacity=0
                    ))
    logger.info("Work schedules seeded.")


def generate_time_slots(db: Session):
    """Generates time slots for the next 4 weeks based on work schedules."""
    logger.info("Generating time slots for the next 4 weeks...")
    db.query(models.TimeSlot).delete() # Clear existing slots
    schedules = db.query(models.WorkSchedule).all()
    
    start_date = date.today()
    end_date = start_date + timedelta(weeks=4)
    slots_created = 0
    
    current_date = start_date
    while current_date <= end_date:
        weekday = current_date.weekday()
        
        for schedule in schedules:
            if (schedule.day_of_week == weekday and 
                schedule.is_working_day and 
                schedule.work_start and 
                schedule.work_end):
                
                current_time = schedule.work_start
                while current_time < schedule.work_end:
                    next_time = (datetime.combine(current_date, current_time) + timedelta(minutes=30)).time()
                    
                    if (schedule.break_start and schedule.break_end and 
                        current_time < schedule.break_end and next_time > schedule.break_start):
                        current_time = schedule.break_end
                        continue
                    
                    db.add(models.TimeSlot(
                        dock_id=schedule.dock_id,
                        slot_date=current_date,
                        start_time=current_time,
                        end_time=next_time,
                        capacity=schedule.capacity,
                        is_available=True,
                    ))
                    slots_created += 1
                    current_time = next_time
        
        current_date += timedelta(days=1)
        
    logger.info(f"{slots_created} time slots generated.")


def setup_database():
    """
    Main function to initialize the database from scratch.
    - Creates all tables.
    - Creates the admin user.
    - Seeds the database with initial data.
    - Generates time slots.
    """
    db: Session = SessionLocal()
    try:
        logger.info("--- Database Setup Started ---")
        
        create_schema(db)
        create_admin_user(db)
        seed_initial_data(db)
        db.commit() # Commit changes before generating time slots
        generate_time_slots(db)
        
        db.commit()
        logger.info("✅ Database setup completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ An error occurred during database setup: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    setup_database()
