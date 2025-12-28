from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas
from app.deps import get_db

router = APIRouter()


def _validate_duration(duration: int) -> None:
    if duration < 0 or duration % 30 != 0:
        raise HTTPException(
            status_code=400,
            detail="Длительность должна быть неотрицательной и кратной 30 минутам",
        )


@router.get("/duration/", response_model=schemas.PrrLimit)
def get_duration(
    object_id: int,
    supplier_id: Optional[int] = None,
    transport_type_id: Optional[int] = None,
    vehicle_type_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    # 1. Exact match
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == supplier_id,
        models.PrrLimit.transport_type_id == transport_type_id,
        models.PrrLimit.vehicle_type_id == vehicle_type_id
    )
    result = query.first()
    if result:
        return result

    # 2. Less specific rules
    # object + supplier + transport
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == supplier_id,
        models.PrrLimit.transport_type_id == transport_type_id,
        models.PrrLimit.vehicle_type_id == None
    )
    result = query.first()
    if result:
        return result
        
    # object + supplier + vehicle
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == supplier_id,
        models.PrrLimit.transport_type_id == None,
        models.PrrLimit.vehicle_type_id == vehicle_type_id
    )
    result = query.first()
    if result:
        return result

    # object + transport + vehicle
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == None,
        models.PrrLimit.transport_type_id == transport_type_id,
        models.PrrLimit.vehicle_type_id == vehicle_type_id
    )
    result = query.first()
    if result:
        return result

    # object + supplier
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == supplier_id,
        models.PrrLimit.transport_type_id == None,
        models.PrrLimit.vehicle_type_id == None
    )
    result = query.first()
    if result:
        return result

    # object + transport
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == None,
        models.PrrLimit.transport_type_id == transport_type_id,
        models.PrrLimit.vehicle_type_id == None
    )
    result = query.first()
    if result:
        return result

    # object + vehicle
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == None,
        models.PrrLimit.transport_type_id == None,
        models.PrrLimit.vehicle_type_id == vehicle_type_id
    )
    result = query.first()
    if result:
        return result

    # object only
    query = db.query(models.PrrLimit).filter(
        models.PrrLimit.object_id == object_id,
        models.PrrLimit.supplier_id == None,
        models.PrrLimit.transport_type_id == None,
        models.PrrLimit.vehicle_type_id == None
    )
    result = query.first()
    if result:
        return result

    raise HTTPException(status_code=404, detail="No matching PRR limit found")


@router.post("/", response_model=schemas.PrrLimit)
def create_prr_limit(prr_limit: schemas.PrrLimitCreate, db: Session = Depends(get_db)):
    _validate_duration(prr_limit.duration_minutes)
    db_prr_limit = models.PrrLimit(**prr_limit.dict())
    db.add(db_prr_limit)
    db.commit()
    db.refresh(db_prr_limit)
    return db_prr_limit

@router.get("/", response_model=List[schemas.PrrLimit])
def read_prr_limits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prr_limits = db.query(models.PrrLimit).offset(skip).limit(limit).all()
    return prr_limits

@router.get("/{prr_limit_id}", response_model=schemas.PrrLimit)
def read_prr_limit(prr_limit_id: int, db: Session = Depends(get_db)):
    db_prr_limit = db.query(models.PrrLimit).filter(models.PrrLimit.id == prr_limit_id).first()
    if db_prr_limit is None:
        raise HTTPException(status_code=404, detail="PrrLimit not found")
    return db_prr_limit

@router.put("/{prr_limit_id}", response_model=schemas.PrrLimit)
def update_prr_limit(prr_limit_id: int, prr_limit: schemas.PrrLimitUpdate, db: Session = Depends(get_db)):
    db_prr_limit = db.query(models.PrrLimit).filter(models.PrrLimit.id == prr_limit_id).first()
    if db_prr_limit is None:
        raise HTTPException(status_code=404, detail="PrrLimit not found")

    update_payload = prr_limit.dict(exclude_unset=True)
    if "duration_minutes" in update_payload:
        _validate_duration(update_payload["duration_minutes"])

    for key, value in update_payload.items():
        setattr(db_prr_limit, key, value)
        
    db.commit()
    db.refresh(db_prr_limit)
    return db_prr_limit

@router.delete("/{prr_limit_id}", response_model=schemas.PrrLimit)
def delete_prr_limit(prr_limit_id: int, db: Session = Depends(get_db)):
    db_prr_limit = db.query(models.PrrLimit).filter(models.PrrLimit.id == prr_limit_id).first()
    if db_prr_limit is None:
        raise HTTPException(status_code=404, detail="PrrLimit not found")
    db.delete(db_prr_limit)
    db.commit()
    return db_prr_limit
