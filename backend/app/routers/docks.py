from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from .. import models, schemas
from ..deps import require_admin, get_current_user

router = APIRouter()


@router.get("/", response_model=List[schemas.Dock])
def list_docks(db: Session = Depends(get_db)):
    return db.query(models.Dock).all()


@router.post("/", response_model=schemas.Dock, status_code=status.HTTP_201_CREATED)
def create_dock(payload: schemas.DockCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    dock = models.Dock(
        name=payload.name,
        status=payload.status,
        length_meters=payload.length_meters,
        width_meters=payload.width_meters,
        max_load_kg=payload.max_load_kg,
    )
    db.add(dock)
    db.commit()
    db.refresh(dock)
    return dock


@router.get("/{dock_id}", response_model=schemas.Dock)
def get_dock(dock_id: int, db: Session = Depends(get_db)):
    dock = db.query(models.Dock).get(dock_id)
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

    db.commit()
    db.refresh(dock)
    return dock


@router.delete("/{dock_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dock(dock_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    dock = db.query(models.Dock).get(dock_id)
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")
    db.delete(dock)
    db.commit()
    return None
