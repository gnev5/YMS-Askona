from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..db import get_db
from ..models import Supplier, UserSupplier, UserRole, VehicleType, TransportTypeRef
from ..schemas import (
    Supplier as SupplierSchema,
    SupplierCreate,
    SupplierUpdate,
    SupplierWithZone,
    UserSupplier as UserSupplierSchema,
    UserSupplierCreate,
)
from ..deps import get_current_user

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("/", response_model=List[SupplierWithZone])
def get_suppliers(db: Session = Depends(get_db)):
    return (
        db.query(Supplier)
        .options(
            joinedload(Supplier.zone),
            joinedload(Supplier.vehicle_types),
            joinedload(Supplier.transport_types),
        )
        .all()
    )


@router.get("/my", response_model=List[SupplierWithZone])
def get_my_suppliers(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        return (
            db.query(Supplier)
            .options(
                joinedload(Supplier.zone),
                joinedload(Supplier.vehicle_types),
                joinedload(Supplier.transport_types),
            )
            .all()
        )

    user_suppliers = db.query(UserSupplier).filter(UserSupplier.user_id == current_user.id).all()
    supplier_ids = [us.supplier_id for us in user_suppliers]
    return (
        db.query(Supplier)
        .options(
            joinedload(Supplier.zone),
            joinedload(Supplier.vehicle_types),
            joinedload(Supplier.transport_types),
        )
        .filter(Supplier.id.in_(supplier_ids))
        .all()
    )


@router.post("/", response_model=SupplierSchema)
def create_supplier(
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # Связи
    vehicle_types = db.query(VehicleType).filter(VehicleType.id.in_(supplier.vehicle_type_ids)).all()
    if len(vehicle_types) != len(supplier.vehicle_type_ids):
        raise HTTPException(status_code=404, detail="One or more vehicle types not found")
        
    transport_types = db.query(TransportTypeRef).filter(TransportTypeRef.id.in_(supplier.transport_type_ids)).all()
    if len(transport_types) != len(supplier.transport_type_ids):
        raise HTTPException(status_code=404, detail="One or more transport types not found")

    data = supplier.dict()
    data.pop("vehicle_type_ids", None)
    data.pop("transport_type_ids", None)

    db_supplier = Supplier(**data)
    db_supplier.vehicle_types = vehicle_types
    db_supplier.transport_types = transport_types
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier


@router.get("/{supplier_id}", response_model=SupplierWithZone)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = (
        db.query(Supplier)
        .options(
            joinedload(Supplier.zone),
            joinedload(Supplier.vehicle_types),
            joinedload(Supplier.transport_types),
        )
        .filter(Supplier.id == supplier_id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.put("/{supplier_id}", response_model=SupplierSchema)
def update_supplier(
    supplier_id: int,
    supplier: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    db_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Обновляем связи
    if supplier.vehicle_type_ids is not None:
        vehicle_types = db.query(VehicleType).filter(VehicleType.id.in_(supplier.vehicle_type_ids)).all()
        if len(vehicle_types) != len(supplier.vehicle_type_ids):
            raise HTTPException(status_code=404, detail="One or more vehicle types not found")
        db_supplier.vehicle_types = vehicle_types

    if supplier.transport_type_ids is not None:
        transport_types = db.query(TransportTypeRef).filter(TransportTypeRef.id.in_(supplier.transport_type_ids)).all()
        if len(transport_types) != len(supplier.transport_type_ids):
            raise HTTPException(status_code=404, detail="One or more transport types not found")
        db_supplier.transport_types = transport_types

    # Обновляем остальные поля
    update_data = supplier.dict(exclude_unset=True)
    update_data.pop("vehicle_type_ids", None)
    update_data.pop("transport_type_ids", None)

    for key, value in update_data.items():
        setattr(db_supplier, key, value)

    db.commit()
    db.refresh(db_supplier)
    return db_supplier


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    db_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    db.delete(db_supplier)
    db.commit()
    return {"message": "Supplier deleted"}


@router.get("/user/{user_id}", response_model=List[SupplierWithZone])
def get_user_suppliers(user_id: int, db: Session = Depends(get_db)):
    user_suppliers = db.query(UserSupplier).filter(UserSupplier.user_id == user_id).all()
    supplier_ids = [us.supplier_id for us in user_suppliers]
    return (
        db.query(Supplier)
        .options(
            joinedload(Supplier.zone),
            joinedload(Supplier.vehicle_types),
            joinedload(Supplier.transport_types),
        )
        .filter(Supplier.id.in_(supplier_ids))
        .all()
    )


@router.post("/user/{user_id}/supplier/{supplier_id}", response_model=UserSupplierSchema)
def add_user_supplier(
    user_id: int,
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    existing = (
        db.query(UserSupplier)
        .filter(
            UserSupplier.user_id == user_id,
            UserSupplier.supplier_id == supplier_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Relation already exists")

    user_supplier = UserSupplier(user_id=user_id, supplier_id=supplier_id)
    db.add(user_supplier)
    db.commit()
    db.refresh(user_supplier)
    return user_supplier


@router.delete("/user/{user_id}/supplier/{supplier_id}")
def remove_user_supplier(
    user_id: int,
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    user_supplier = (
        db.query(UserSupplier)
        .filter(
            UserSupplier.user_id == user_id,
            UserSupplier.supplier_id == supplier_id,
        )
        .first()
    )

    if not user_supplier:
        raise HTTPException(status_code=404, detail="Relation not found")

    db.delete(user_supplier)
    db.commit()
    return {"message": "Relation deleted"}
