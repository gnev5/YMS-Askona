from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import TransportTypeRef
from ..schemas import TransportType, TransportTypeCreate
from ..deps import require_admin

router = APIRouter(prefix="/api/transport-types", tags=["transport-types"])


@router.get("/", response_model=List[TransportType])
def get_transport_types(db: Session = Depends(get_db)):
    """Получить типы перевозок."""
    return db.query(TransportTypeRef).all()


@router.post("/", response_model=TransportType)
def create_transport_type(
    transport_type: TransportTypeCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Создать тип перевозки (только для админа)."""
    db_transport_type = TransportTypeRef(**transport_type.dict())
    db.add(db_transport_type)
    db.commit()
    db.refresh(db_transport_type)
    return db_transport_type


@router.get("/{transport_type_id}", response_model=TransportType)
def get_transport_type(transport_type_id: int, db: Session = Depends(get_db)):
    """Получить тип перевозки по ID."""
    transport_type = db.query(TransportTypeRef).filter(TransportTypeRef.id == transport_type_id).first()
    if not transport_type:
        raise HTTPException(status_code=404, detail="Тип перевозки не найден")
    return transport_type


@router.put("/{transport_type_id}", response_model=TransportType)
def update_transport_type(
    transport_type_id: int,
    transport_type: TransportTypeCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Обновить тип перевозки (только для админа)."""
    db_transport_type = db.query(TransportTypeRef).filter(TransportTypeRef.id == transport_type_id).first()
    if not db_transport_type:
        raise HTTPException(status_code=404, detail="Тип перевозки не найден")

    for key, value in transport_type.dict().items():
        setattr(db_transport_type, key, value)

    db.commit()
    db.refresh(db_transport_type)
    return db_transport_type


@router.delete("/{transport_type_id}")
def delete_transport_type(
    transport_type_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Удалить тип перевозки (только для админа)."""
    db_transport_type = db.query(TransportTypeRef).filter(TransportTypeRef.id == transport_type_id).first()
    if not db_transport_type:
        raise HTTPException(status_code=404, detail="Тип перевозки не найден")

    db.delete(db_transport_type)
    db.commit()
    return {"message": "Тип перевозки удален"}
