from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..db import get_db
from .. import models, schemas
from ..deps import require_admin, get_current_user

router = APIRouter()


@router.get("/", response_model=List[schemas.Dock])
def list_docks(db: Session = Depends(get_db)):
    return db.query(models.Dock).options(
        joinedload(models.Dock.object),
        joinedload(models.Dock.available_zones),
        joinedload(models.Dock.available_transport_types)
    ).all()


@router.post("/", response_model=schemas.Dock, status_code=status.HTTP_201_CREATED)
def create_dock(payload: schemas.DockCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    dock = models.Dock(
        name=payload.name,
        status=payload.status,
        length_meters=payload.length_meters,
        width_meters=payload.width_meters,
        max_load_kg=payload.max_load_kg,
        dock_type=payload.dock_type,
        object_id=payload.object_id,
    )
    
    # Add zones
    if payload.available_zone_ids:
        zones = db.query(models.Zone).filter(models.Zone.id.in_(payload.available_zone_ids)).all()
        dock.available_zones.extend(zones)

    # Add transport types
    if payload.available_transport_type_ids:
        transport_types = db.query(models.TransportTypeRef).filter(models.TransportTypeRef.id.in_(payload.available_transport_type_ids)).all()
        dock.available_transport_types.extend(transport_types)

    db.add(dock)
    db.commit()
    db.refresh(dock)
    return dock


@router.get("/{dock_id}", response_model=schemas.Dock)
def get_dock(dock_id: int, db: Session = Depends(get_db)):
    dock = db.query(models.Dock).options(
        joinedload(models.Dock.object),
        joinedload(models.Dock.available_zones),
        joinedload(models.Dock.available_transport_types)
    ).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")
    return dock


@router.put("/{dock_id}", response_model=schemas.Dock)
def update_dock(dock_id: int, payload: schemas.DockCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    dock = db.query(models.Dock).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")

    dock.name = payload.name
    dock.status = payload.status
    dock.length_meters = payload.length_meters
    dock.width_meters = payload.width_meters
    dock.max_load_kg = payload.max_load_kg
    dock.dock_type = payload.dock_type
    dock.object_id = payload.object_id

    # Update zones
    if payload.available_zone_ids:
        zones = db.query(models.Zone).filter(models.Zone.id.in_(payload.available_zone_ids)).all()
        dock.available_zones = zones
    else:
        dock.available_zones = []

    # Update transport types
    if payload.available_transport_type_ids:
        transport_types = db.query(models.TransportTypeRef).filter(models.TransportTypeRef.id.in_(payload.available_transport_type_ids)).all()
        dock.available_transport_types = transport_types
    else:
        dock.available_transport_types = []

    db.commit()
    db.refresh(dock)
    return dock


@router.get("/{dock_id}/zones", response_model=List[schemas.Zone])
def get_dock_zones(dock_id: int, db: Session = Depends(get_db)):
    """
    Получить список зон, привязанных к доку.
    """
    dock = db.query(models.Dock).options(joinedload(models.Dock.available_zones)).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")
    return dock.available_zones


@router.put("/{dock_id}/zones", response_model=schemas.Dock)
def update_dock_zones(dock_id: int, payload: schemas.DockZoneUpdate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """
    Обновить список зон, привязанных к доку.
    """
    dock = db.query(models.Dock).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")

    if payload.zone_ids:
        zones = db.query(models.Zone).filter(models.Zone.id.in_(payload.zone_ids)).all()
        # Проверка, что все запрошенные ID зон существуют
        if len(zones) != len(payload.zone_ids):
            raise HTTPException(status_code=404, detail="One or more zones not found")
        dock.available_zones = zones
    else:
        dock.available_zones = []

    db.commit()
    db.refresh(dock)
    # Загружаем связанные данные для корректного ответа
    dock_with_relations = db.query(models.Dock).options(
        joinedload(models.Dock.object),
        joinedload(models.Dock.available_zones),
        joinedload(models.Dock.available_transport_types)
    ).get(dock_id)
    return dock_with_relations


@router.get("/{dock_id}/transport-types", response_model=List[schemas.TransportType])
def get_dock_transport_types(dock_id: int, db: Session = Depends(get_db)):
    """
    Получить список типов перевозок, привязанных к доку.
    """
    dock = db.query(models.Dock).options(joinedload(models.Dock.available_transport_types)).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")
    return dock.available_transport_types


@router.put("/{dock_id}/transport-types", response_model=schemas.Dock)
def update_dock_transport_types(dock_id: int, payload: schemas.DockTransportTypeUpdate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """
    Обновить список типов перевозок, привязанных к доку.
    """
    dock = db.query(models.Dock).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")

    if payload.transport_type_ids:
        transport_types = db.query(models.TransportTypeRef).filter(models.TransportTypeRef.id.in_(payload.transport_type_ids)).all()
        if len(transport_types) != len(payload.transport_type_ids):
            raise HTTPException(status_code=404, detail="One or more transport types not found")
        dock.available_transport_types = transport_types
    else:
        dock.available_transport_types = []

    db.commit()
    db.refresh(dock)
    # Загружаем связанные данные для корректного ответа
    dock_with_relations = db.query(models.Dock).options(
        joinedload(models.Dock.object),
        joinedload(models.Dock.available_zones),
        joinedload(models.Dock.available_transport_types)
    ).get(dock_id)
    return dock_with_relations


@router.delete("/{dock_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dock(dock_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    dock = db.query(models.Dock).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")
    db.delete(dock)
    db.commit()
    return None
