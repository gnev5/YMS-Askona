from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import Supplier, UserSupplier, UserRole
from ..schemas import Supplier as SupplierSchema, SupplierCreate, SupplierWithZone, UserSupplier as UserSupplierSchema, UserSupplierCreate
from ..deps import get_current_user

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("/", response_model=List[SupplierWithZone])
def get_suppliers(db: Session = Depends(get_db)):
    """Получить всех поставщиков"""
    return db.query(Supplier).all()


@router.get("/my", response_model=List[SupplierWithZone])
def get_my_suppliers(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Получить поставщиков для текущего пользователя
    Администраторы видят всех поставщиков, обычные пользователи - только привязанных к ним
    """
    # Проверяем роль пользователя с использованием enum
    if current_user.role == UserRole.admin:
        # Администратор видит всех поставщиков
        return db.query(Supplier).all()
    else:
        # Обычный пользователь видит только привязанных к нему поставщиков
        user_suppliers = db.query(UserSupplier).filter(UserSupplier.user_id == current_user.id).all()
        supplier_ids = [us.supplier_id for us in user_suppliers]
        return db.query(Supplier).filter(Supplier.id.in_(supplier_ids)).all()


@router.post("/", response_model=SupplierSchema)
def create_supplier(
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Создать нового поставщика (только для админов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    db_supplier = Supplier(**supplier.dict())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier


@router.get("/{supplier_id}", response_model=SupplierWithZone)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """Получить поставщика по ID"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    return supplier


@router.put("/{supplier_id}", response_model=SupplierSchema)
def update_supplier(
    supplier_id: int,
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Обновить поставщика (только для админов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    db_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    
    for key, value in supplier.dict().items():
        setattr(db_supplier, key, value)
    
    db.commit()
    db.refresh(db_supplier)
    return db_supplier


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Удалить поставщика (только для админов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    db_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    
    db.delete(db_supplier)
    db.commit()
    return {"message": "Поставщик удален"}


# Управление связями пользователей с поставщиками
@router.get("/user/{user_id}", response_model=List[SupplierWithZone])
def get_user_suppliers(user_id: int, db: Session = Depends(get_db)):
    """Получить поставщиков пользователя"""
    user_suppliers = db.query(UserSupplier).filter(UserSupplier.user_id == user_id).all()
    supplier_ids = [us.supplier_id for us in user_suppliers]
    return db.query(Supplier).filter(Supplier.id.in_(supplier_ids)).all()


@router.post("/user/{user_id}/supplier/{supplier_id}", response_model=UserSupplierSchema)
def add_user_supplier(
    user_id: int,
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Добавить связь пользователя с поставщиком"""
    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    # Проверяем, что поставщик существует
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    
    # Проверяем, что связь не существует
    existing = db.query(UserSupplier).filter(
        UserSupplier.user_id == user_id,
        UserSupplier.supplier_id == supplier_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Связь уже существует")
    
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
    current_user = Depends(get_current_user)
):
    """Удалить связь пользователя с поставщиком"""
    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    user_supplier = db.query(UserSupplier).filter(
        UserSupplier.user_id == user_id,
        UserSupplier.supplier_id == supplier_id
    ).first()
    
    if not user_supplier:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    
    db.delete(user_supplier)
    db.commit()
    return {"message": "Связь удалена"}
