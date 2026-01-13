from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base
from .routers import docks, vehicle_types, auth, work_schedules, time_slots, bookings, transport_types, zones, suppliers, analytics, objects, prr_limits, backups, volume_quotas

import logging

# Set up logging with timestamp
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

app = FastAPI(title="YMS Backend")

# CORS for frontend dev
# CORS: ограничиваемся понятными фронт-источниками, чтобы не блокировало preflight с credentials
FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup (simple bootstrap; replace with migrations in production)
Base.metadata.create_all(bind=engine)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(docks.router, prefix="/api/docks", tags=["docks"])
app.include_router(vehicle_types.router, prefix="/api/vehicle-types", tags=["vehicle_types"]) 
app.include_router(work_schedules.router, prefix="/api/work-schedules", tags=["work_schedules"]) 
app.include_router(time_slots.router, prefix="/api/time-slots", tags=["time_slots"]) 
app.include_router(bookings.router, prefix="/api/bookings", tags=["bookings"])
app.include_router(transport_types.router)
app.include_router(zones.router)
app.include_router(suppliers.router)
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(objects.router, prefix="/api/objects", tags=["objects"])
app.include_router(prr_limits.router, prefix="/api/prr-limits", tags=["prr_limits"])
app.include_router(volume_quotas.router, prefix="/api/volume-quotas", tags=["volume_quotas"])
app.include_router(backups.router)
