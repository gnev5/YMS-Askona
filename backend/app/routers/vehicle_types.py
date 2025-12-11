from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from .. import models, schemas
from ..deps import require_admin

router = APIRouter()


@router.get("/", response_model=List[schemas.VehicleType])
def list_vehicle_types(db: Session = Depends(get_db)):
    return db.query(models.VehicleType).all()


@router.post("/", response_model=schemas.VehicleType, status_code=status.HTTP_201_CREATED)
def create_vehicle_type(payload: schemas.VehicleTypeCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    vt = models.VehicleType(name=payload.name, duration_minutes=payload.duration_minutes)
    db.add(vt)
    db.commit()
    db.refresh(vt)
    return vt


@router.get("/{vehicle_type_id}", response_model=schemas.VehicleType)
def get_vehicle_type(vehicle_type_id: int, db: Session = Depends(get_db)):
    vt = db.query(models.VehicleType).get(vehicle_type_id)
    if not vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    return vt


@router.put("/{vehicle_type_id}", response_model=schemas.VehicleType)
def update_vehicle_type(vehicle_type_id: int, payload: schemas.VehicleTypeCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    vt = db.query(models.VehicleType).get(vehicle_type_id)
    if not vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    vt.name = payload.name
    vt.duration_minutes = payload.duration_minutes

    db.commit()
    db.refresh(vt)
    return vt


@router.delete("/{vehicle_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle_type(vehicle_type_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    vt = db.query(models.VehicleType).get(vehicle_type_id)
    if not vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    db.delete(vt)
    db.commit()
    return None
