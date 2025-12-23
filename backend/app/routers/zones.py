from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import Zone
from ..schemas import Zone as ZoneSchema, ZoneCreate
from ..deps import require_admin

router = APIRouter(prefix="/api/zones", tags=["zones"])


@router.get("/", response_model=List[ZoneSchema])
def get_zones(db: Session = Depends(get_db)):
    """Получить список зон."""
    return db.query(Zone).all()


@router.post("/", response_model=ZoneSchema)
def create_zone(
    zone: ZoneCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Создать новую зону (только для админа)."""
    db_zone = Zone(**zone.dict())
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone


@router.get("/{zone_id}", response_model=ZoneSchema)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    """Получить зону по ID."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Зона не найдена")
    return zone


@router.put("/{zone_id}", response_model=ZoneSchema)
def update_zone(
    zone_id: int,
    zone: ZoneCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Обновить зону (только для админа)."""
    db_zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not db_zone:
        raise HTTPException(status_code=404, detail="Зона не найдена")

    for key, value in zone.dict().items():
        setattr(db_zone, key, value)

    db.commit()
    db.refresh(db_zone)
    return db_zone


@router.delete("/{zone_id}")
def delete_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Удалить зону (только для админа)."""
    db_zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not db_zone:
        raise HTTPException(status_code=404, detail="Зона не найдена")

    db.delete(db_zone)
    db.commit()
    return {"message": "Зона удалена"}
