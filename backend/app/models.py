from datetime import datetime, time, date
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Enum, Time, UniqueConstraint, Date, Table, Float, Text, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
import enum


class DockStatus(enum.Enum):
    active = "active"
    inactive = "inactive"
    maintenance = "maintenance"


class UserRole(enum.Enum):
    admin = "admin"
    carrier = "carrier"


class DockType(enum.Enum):
    universal = "universal"
    entrance = "entrance"
    exit = "exit"


class ObjectType(enum.Enum):
    warehouse = "warehouse"
    production = "production"
    retail = "retail"
    pickup_point = "pickup_point"
    other = "other"


class TransportType(enum.Enum):
    own_production = "own_production"
    purchased = "purchased"
    container = "container"
    return_goods = "return_goods"


class Object(Base):
    __tablename__ = "objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    object_type: Mapped[ObjectType] = mapped_column(Enum(ObjectType), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=True)

    docks: Mapped[list["Dock"]] = relationship("Dock", back_populates="object")
    prr_limits: Mapped[list["PrrLimit"]] = relationship("PrrLimit", back_populates="object")


dock_zone_association = Table(
    'dock_zone_association', Base.metadata,
    Column('dock_id', Integer, ForeignKey('docks.id', ondelete="CASCADE"), primary_key=True),
    Column('zone_id', Integer, ForeignKey('zones.id', ondelete="CASCADE"), primary_key=True)
)

dock_transport_type_association = Table(
    'dock_transport_type_association', Base.metadata,
    Column('dock_id', Integer, ForeignKey('docks.id', ondelete="CASCADE"), primary_key=True),
    Column('transport_type_id', Integer, ForeignKey('transport_types.id', ondelete="CASCADE"), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.carrier, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Dock(Base):
    __tablename__ = "docks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[DockStatus] = mapped_column(Enum(DockStatus), default=DockStatus.active, nullable=False)
    length_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_load_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Новые поля
    dock_type: Mapped[DockType] = mapped_column(Enum(DockType), default=DockType.universal, nullable=False)
    
    # Связи
    object_id: Mapped[int] = mapped_column(ForeignKey("objects.id"), nullable=False)
    object: Mapped["Object"] = relationship("Object", back_populates="docks")
    
    available_zones: Mapped[list["Zone"]] = relationship("Zone", secondary=dock_zone_association, back_populates="docks")
    available_transport_types: Mapped[list["TransportTypeRef"]] = relationship("TransportTypeRef", secondary=dock_transport_type_association, back_populates="docks")


class VehicleType(Base):
    __tablename__ = "vehicle_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)


# НОВЫЕ СПРАВОЧНИКИ

class TransportTypeRef(Base):
    __tablename__ = "transport_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    enum_value: Mapped[TransportType] = mapped_column(Enum(TransportType), nullable=False)

    # Связи
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="transport_type")
    docks: Mapped[list["Dock"]] = relationship("Dock", secondary=dock_transport_type_association, back_populates="available_transport_types")
    suppliers: Mapped[list["Supplier"]] = relationship("Supplier", back_populates="transport_type")
    prr_limits: Mapped[list["PrrLimit"]] = relationship("PrrLimit", back_populates="transport_type")


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # Связи
    docks: Mapped[list["Dock"]] = relationship("Dock", secondary=dock_zone_association, back_populates="available_zones")
    suppliers: Mapped[list["Supplier"]] = relationship("Supplier", back_populates="zone")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="zone")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), nullable=False)

    # Связи
    zone: Mapped["Zone"] = relationship("Zone", back_populates="suppliers")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="supplier")
    user_suppliers: Mapped[list["UserSupplier"]] = relationship("UserSupplier", back_populates="supplier")

    transport_type_id: Mapped[int | None] = mapped_column(ForeignKey("transport_types.id"), nullable=True)
    transport_type: Mapped["TransportTypeRef | None"] = relationship("TransportTypeRef", back_populates="suppliers")
    
    prr_limits: Mapped[list["PrrLimit"]] = relationship("PrrLimit", back_populates="supplier")


# Связь многие-ко-многим между пользователями и поставщиками
user_supplier_table = Table(
    "user_suppliers",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("supplier_id", Integer, ForeignKey("suppliers.id"), primary_key=True)
)


class UserSupplier(Base):
    __tablename__ = "user_supplier_relations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    # Связи
    user: Mapped["User"] = relationship("User")
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="user_suppliers")

    __table_args__ = (
        UniqueConstraint("user_id", "supplier_id", name="uq_user_supplier"),
    )


class WorkSchedule(Base):
    __tablename__ = "work_schedules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon ... 6=Sun
    dock_id: Mapped[int] = mapped_column(ForeignKey("docks.id"), nullable=False)
    work_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    work_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_working_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint("day_of_week", "dock_id", name="uq_work_schedules_day_dock"),
    )


# НОВАЯ МОДЕЛЬ: Временные слоты привязанные к конкретным датам
class TimeSlot(Base):
    __tablename__ = "time_slots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dock_id: Mapped[int] = mapped_column(ForeignKey("docks.id"), nullable=False)
    slot_date: Mapped[date] = mapped_column(Date, nullable=False)  # Конкретная дата
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Можно отключить слот
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    dock: Mapped["Dock"] = relationship("Dock")
    booking_slots: Mapped[list["BookingTimeSlot"]] = relationship("BookingTimeSlot", back_populates="time_slot")

    __table_args__ = (
        UniqueConstraint("dock_id", "slot_date", "start_time", "end_time", name="uq_time_slots_unique"),
    )


# НОВАЯ МОДЕЛЬ: Основная запись на ПРР (одна запись = одна перевозка)
class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    vehicle_type_id: Mapped[int] = mapped_column(ForeignKey("vehicle_types.id"), nullable=False)
    
    # Информация о транспорте и водителе
    vehicle_plate: Mapped[str] = mapped_column(String(20), nullable=False)
    driver_full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    driver_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    
    # Новые поля
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id"), nullable=True)
    transport_type_id: Mapped[int | None] = mapped_column(ForeignKey("transport_types.id"), nullable=True)
    cubes: Mapped[float | None] = mapped_column(Float, nullable=True)
    transport_sheet: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    # Статус записи
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)  # confirmed, cancelled, completed
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user: Mapped["User"] = relationship("User")
    vehicle_type: Mapped["VehicleType"] = relationship("VehicleType")
    supplier: Mapped["Supplier | None"] = relationship("Supplier", back_populates="bookings")
    zone: Mapped["Zone | None"] = relationship("Zone", back_populates="bookings")
    transport_type: Mapped["TransportTypeRef | None"] = relationship("TransportTypeRef", back_populates="bookings")
    booking_slots: Mapped[list["BookingTimeSlot"]] = relationship("BookingTimeSlot", back_populates="booking")


# НОВАЯ МОДЕЛЬ: Связь многие-ко-многим между записями и временными слотами
class BookingTimeSlot(Base):
    __tablename__ = "booking_time_slots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    time_slot_id: Mapped[int] = mapped_column(ForeignKey("time_slots.id", ondelete="CASCADE"), nullable=False)
    
    # Связи
    booking: Mapped["Booking"] = relationship("Booking", back_populates="booking_slots")
    time_slot: Mapped["TimeSlot"] = relationship("TimeSlot", back_populates="booking_slots")

    __table_args__ = (
        UniqueConstraint("booking_id", "time_slot_id", name="uq_booking_time_slot"),
    )


class PrrLimit(Base):
    __tablename__ = 'prr_limits'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    object_id: Mapped[int] = mapped_column(ForeignKey('objects.id'), nullable=False)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey('suppliers.id'), nullable=True)
    transport_type_id: Mapped[int | None] = mapped_column(ForeignKey('transport_types.id'), nullable=True)
    vehicle_type_id: Mapped[int | None] = mapped_column(ForeignKey('vehicle_types.id'), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    object: Mapped["Object"] = relationship("Object", back_populates="prr_limits")
    supplier: Mapped["Supplier | None"] = relationship("Supplier", back_populates="prr_limits")
    transport_type: Mapped["TransportTypeRef | None"] = relationship("TransportTypeRef", back_populates="prr_limits")
    vehicle_type: Mapped["VehicleType | None"] = relationship("VehicleType")

    __table_args__ = (
        UniqueConstraint('object_id', 'supplier_id', 'transport_type_id', 'vehicle_type_id', name='_object_supplier_transport_vehicle_uc'),
    )
