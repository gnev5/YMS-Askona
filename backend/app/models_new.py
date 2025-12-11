from datetime import datetime, time, date
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Enum, Time, UniqueConstraint, Date, Table
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


class VehicleType(Base):
    __tablename__ = "vehicle_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)


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
    
    # Статус записи
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)  # confirmed, cancelled, completed
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user: Mapped["User"] = relationship("User")
    vehicle_type: Mapped["VehicleType"] = relationship("VehicleType")
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
