from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..security import get_password_hash, verify_password, create_access_token
from ..deps import get_current_user, get_current_admin
from typing import List

router = APIRouter()


@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.email == user_in.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="User already exists")

    try:
        role = models.UserRole(user_in.role) if user_in.role else models.UserRole.user
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role value")

    new_user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        password_hash=get_password_hash(user_in.password),
        role=role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # debug trace
    print("/auth/login: start for", form_data.username)
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    print("/auth/login: queried user ->", bool(user))
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    print("/auth/login: password verified")
    access_token = create_access_token(subject=user.email, expires_delta=timedelta(minutes=60))
    print("/auth/login: token issued")
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.User)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

# Admin: users management
@router.get("/users", response_model=List[schemas.User])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(get_current_admin)):
    return db.query(models.User).all()

@router.post("/users", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user_admin(user_in: schemas.UserCreate, db: Session = Depends(get_db), _: models.User = Depends(get_current_admin)):
    exists = db.query(models.User).filter(models.User.email == user_in.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="User already exists")
    try:
        role = models.UserRole(user_in.role) if user_in.role else models.UserRole.carrier
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role value")
    user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        password_hash=get_password_hash(user_in.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}", response_model=schemas.User)
def update_user_admin(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db), _: models.User = Depends(get_current_admin)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        try:
            user.role = models.UserRole(payload.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role value")
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user_admin(user_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_admin)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
