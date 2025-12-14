from sqlalchemy.orm import Session
from .db import SessionLocal, engine, Base
from . import models
from .security import get_password_hash


def create_admin_user():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # Seed admin user
        admin_email = "admin@yms.local"
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin:
            db.add(models.User(
                email=admin_email,
                full_name="YMS Admin",
                password_hash=get_password_hash("Admin1234!"),
                role=models.UserRole.admin,
            ))
            db.commit()
            print("Admin user created successfully")
        else:
            print("Admin user already exists")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_admin_user()