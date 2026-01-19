from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime

# User schemas
class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str
    role: str = "carrier"
    full_name: str

class UserAdminCreate(UserBase):
    password: str
    role: str = "carrier"
    full_name: str
    is_active: bool = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserInDB(UserBase):
    id: int
    password_hash: str
    role: str
    full_name: str
    is_active: bool

class User(UserBase):
    id: int
    role: str
    full_name: str
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

# Object schemas
class ObjectBase(BaseModel):
    name: str
    object_type: str
    address: Optional[str] = None
    capacity_in: Optional[int] = None
    capacity_out: Optional[int] = None

class ObjectCreate(ObjectBase):
    pass

class ObjectUpdate(ObjectBase):
    name: Optional[str] = None
    object_type: Optional[str] = None
    address: Optional[str] = None
    capacity_in: Optional[int] = None
    capacity_out: Optional[int] = None

class Object(ObjectBase):
    id: int

    class Config:
        from_attributes = True

# Zone schemas
class ZoneBase(BaseModel):
    name: str

class ZoneCreate(ZoneBase):
    pass

class Zone(ZoneBase):
    id: int

    class Config:
        from_attributes = True

# Transport Type schemas
class TransportTypeBase(BaseModel):
    name: str
    enum_value: str

class TransportTypeCreate(TransportTypeBase):
    pass

class TransportType(TransportTypeBase):
    id: int

    class Config:
        from_attributes = True

# Dock schemas
class DockBase(BaseModel):
    name: str
    status: str
    length_meters: Optional[float] = None
    width_meters: Optional[float] = None
    max_load_kg: Optional[float] = None
    dock_type: str = "universal"
    object_id: int

class DockCreate(DockBase):
    available_zone_ids: List[int] = []
    available_transport_type_ids: List[int] = []

class Dock(DockBase):
    id: int
    object: Object
    available_zones: List[Zone] = []
    available_transport_types: List[TransportType] = []

    class Config:
        from_attributes = True

class DockZoneUpdate(BaseModel):
    zone_ids: List[int]

class DockTransportTypeUpdate(BaseModel):
    transport_type_ids: List[int]

# Vehicle Type schemas
class VehicleTypeBase(BaseModel):
    name: str
    duration_minutes: int

class VehicleTypeCreate(VehicleTypeBase):
    pass

class VehicleType(VehicleTypeBase):
    id: int

    class Config:
        from_attributes = True

# Work Schedule schemas
class WorkScheduleBase(BaseModel):
    day_of_week: int
    work_start: Optional[str] = None
    work_end: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    capacity: int
    is_working_day: bool = True

class WorkScheduleCreate(WorkScheduleBase):
    dock_id: int

class WorkSchedule(WorkScheduleBase):
    id: int
    dock_id: int

    class Config:
        from_attributes = True

# Time Slot schemas
class TimeSlotBase(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    capacity: int
    dock_id: int

class TimeSlot(TimeSlotBase):
    id: int

    class Config:
        from_attributes = True

class TimeSlotWithOccupancy(TimeSlot):
    occupancy: int
    status: str

class TimeSlotBookingInfo(BaseModel):
    id: int
    supplier_name: Optional[str] = None
    cubes: Optional[float] = None
    transport_sheet: Optional[str] = None
    is_start: bool = False

class TimeSlotWithBookings(TimeSlotWithOccupancy):
    bookings: List[TimeSlotBookingInfo] = []

class TimeSlotCreate(BaseModel):
    dock_id: int
    slot_date: date
    start_time: time
    end_time: time
    capacity: int
    is_available: bool = True

# Booking schemas
class BookingBase(BaseModel):
    vehicle_plate: Optional[str] = None
    driver_full_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_type_id: int

class BookingCreate(BookingBase):
    booking_date: str
    start_time: str

class BookingCancel(BaseModel):
    group_id: str

class Booking(BookingBase):
    id: int
    user_id: int
    status: str
    booking_type: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BookingWithDetails(BaseModel):
    id: int
    booking_date: str
    start_time: str
    end_time: str
    vehicle_plate: str
    driver_name: str
    driver_phone: str
    vehicle_type_name: str
    dock_name: str
    status: str
    slots_count: int
    created_at: str
    supplier_name: Optional[str] = None
    zone_name: Optional[str] = None
    transport_type_name: Optional[str] = None
    cubes: Optional[float] = None
    transport_sheet: Optional[str] = None
    object_id: Optional[int] = None
    object_name: Optional[str] = None
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    booking_type: Optional[str] = None

# Supplier schemas
class SupplierBase(BaseModel):
    name: str
    comment: Optional[str] = None
    zone_id: int

class SupplierCreate(SupplierBase):
    vehicle_type_ids: List[int] = []
    transport_type_ids: List[int] = []

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    comment: Optional[str] = None
    zone_id: Optional[int] = None
    vehicle_type_ids: List[int] = []
    transport_type_ids: List[int] = []

class Supplier(SupplierBase):
    id: int
    vehicle_types: List[VehicleType] = []
    transport_types: List[TransportType] = []

    class Config:
        from_attributes = True

class SupplierWithZone(Supplier):
    zone: Optional[Zone] = None

# User Supplier schemas
class UserSupplierBase(BaseModel):
    user_id: int
    supplier_id: int

class UserSupplierCreate(UserSupplierBase):
    pass

class UserSupplier(UserSupplierBase):
    id: int

    class Config:
        from_attributes = True


# Supplier import schemas
class SupplierImportError(BaseModel):
    row_number: int
    message: str


class SupplierImportResult(BaseModel):
    created: int
    errors: List[SupplierImportError] = []

# Обновленные схемы Booking
class BookingBaseUpdated(BaseModel):
    vehicle_plate: str
    driver_full_name: str
    driver_phone: str
    vehicle_type_id: int
    supplier_id: Optional[int] = None
    zone_id: Optional[int] = None
    transport_type_id: Optional[int] = None
    cubes: Optional[float] = None
    transport_sheet: Optional[str] = None

class BookingCreateUpdated(BookingBaseUpdated):
    booking_date: str
    start_time: str
    object_id: int
    booking_type: str = "in"
    time_slot_id: Optional[int] = None

class BookingUpdated(BookingBaseUpdated):
    id: int
    user_id: int
    status: str
    booking_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BookingWithDetailsUpdated(BookingWithDetails):
    supplier_name: Optional[str] = None
    zone_name: Optional[str] = None
    transport_type_name: Optional[str] = None
    cubes: Optional[float] = None
    transport_sheet: Optional[str] = None

class BookingTransportSheetUpdate(BaseModel):
    transport_sheet: Optional[str] = None

# PrrLimit schemas
class PrrLimitBase(BaseModel):
    object_id: int
    supplier_id: Optional[int] = None
    transport_type_id: Optional[int] = None
    vehicle_type_id: Optional[int] = None
    duration_minutes: int

class PrrLimitCreate(PrrLimitBase):
    pass

class PrrLimitUpdate(PrrLimitBase):
    object_id: Optional[int] = None
    supplier_id: Optional[int] = None
    transport_type_id: Optional[int] = None
    vehicle_type_id: Optional[int] = None
    duration_minutes: Optional[int] = None

class PrrLimit(PrrLimitBase):
    id: int

    class Config:
        from_attributes = True

# PrrLimit import/export schemas
class PrrLimitImportError(BaseModel):
    row_number: int
    message: str


class PrrLimitImportConflict(BaseModel):
    row_number: int
    object_name: str
    supplier_name: Optional[str] = None
    transport_type: Optional[str] = None
    vehicle_type: Optional[str] = None
    existing_duration: Optional[int] = None
    new_duration: int
    source: str  # "database" | "file"


class PrrLimitImportResult(BaseModel):
    created: int
    updated: int
    errors: List[PrrLimitImportError] = []
    conflicts: List[PrrLimitImportConflict] = []

# Volume quota schemas
class VolumeQuotaOverrideBase(BaseModel):
    override_date: date
    volume: float

class VolumeQuotaOverride(VolumeQuotaOverrideBase):
    id: int

    class Config:
        from_attributes = True

class VolumeQuotaBase(BaseModel):
    object_id: int
    direction: str
    year: int
    month: int
    day_of_week: int
    volume: float
    allow_overbooking: bool = True
    transport_type_ids: List[int]

class VolumeQuotaCreate(VolumeQuotaBase):
    overrides: List[VolumeQuotaOverrideBase] = []

class VolumeQuotaUpdate(VolumeQuotaBase):
    overrides: List[VolumeQuotaOverrideBase] = []

class VolumeQuota(VolumeQuotaBase):
    id: int
    overrides: List[VolumeQuotaOverride] = []

    class Config:
        from_attributes = True

class VolumeQuotaAvailability(BaseModel):
    date: date
    total_volume: Optional[float] = None
    used_volume: float
    remaining_volume: float
    allow_overbooking: Optional[bool] = True
    quota_id: Optional[int] = None


class VolumeQuotaImportError(BaseModel):
    sheet: str
    row_number: int
    message: str


class VolumeQuotaImportResult(BaseModel):
    created: int
    updated: int
    errors: List[VolumeQuotaImportError] = []


# Booking import schemas
class BookingImportError(BaseModel):
    row_number: int
    message: str


class BookingImportResult(BaseModel):
    created: int
    errors: List[BookingImportError] = []
