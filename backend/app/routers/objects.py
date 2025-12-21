from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas
from app.deps import get_db

router = APIRouter()

@router.post("/", response_model=schemas.Object)
def create_object(object: schemas.ObjectCreate, db: Session = Depends(get_db)):
    db_object = models.Object(**object.dict())
    db.add(db_object)
    db.commit()
    db.refresh(db_object)
    return db_object

@router.get("/", response_model=List[schemas.Object])
def read_objects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    objects = db.query(models.Object).offset(skip).limit(limit).all()
    return objects

@router.get("/{object_id}", response_model=schemas.Object)
def read_object(object_id: int, db: Session = Depends(get_db)):
    db_object = db.query(models.Object).filter(models.Object.id == object_id).first()
    if db_object is None:
        raise HTTPException(status_code=404, detail="Object not found")
    return db_object

@router.put("/{object_id}", response_model=schemas.Object)
def update_object(object_id: int, object: schemas.ObjectUpdate, db: Session = Depends(get_db)):
    db_object = db.query(models.Object).filter(models.Object.id == object_id).first()
    if db_object is None:
        raise HTTPException(status_code=404, detail="Object not found")
    
    for key, value in object.dict(exclude_unset=True).items():
        setattr(db_object, key, value)
        
    db.commit()
    db.refresh(db_object)
    return db_object

@router.delete("/{object_id}", response_model=schemas.Object)
def delete_object(object_id: int, db: Session = Depends(get_db)):
    db_object = db.query(models.Object).filter(models.Object.id == object_id).first()
    if db_object is None:
        raise HTTPException(status_code=404, detail="Object not found")
    db.delete(db_object)
    db.commit()
    return db_object
