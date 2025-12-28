import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app import models
from app.deps import get_current_user

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module")
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(setup_test_db):
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(autocommit=False, autoflush=False, bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def test_user_fixture(db_session):
    test_user = models.User(email="test@user.com", password_hash="hash", full_name="Test User", role="admin")
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture(scope="function")
def test_client(db_session, test_user_fixture):
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: test_user_fixture
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_db)
    app.dependency_overrides.pop(get_current_user)


def test_create_prr_limit(test_client, db_session):
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    prr_limit_data = {"object_id": test_object.id, "duration_minutes": 60}
    response = test_client.post("/api/prr-limits/", json=prr_limit_data)
    assert response.status_code == 200
    data = response.json()
    assert data["object_id"] == test_object.id
    assert data["duration_minutes"] == 60


def test_create_prr_limit_invalid_duration(test_client, db_session):
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    invalid_payloads = [
        {"object_id": test_object.id, "duration_minutes": -30},
        {"object_id": test_object.id, "duration_minutes": 25},
    ]

    for payload in invalid_payloads:
        response = test_client.post("/api/prr-limits/", json=payload)
        assert response.status_code == 400
        assert response.json()["detail"] == "Длительность должна быть неотрицательной и кратной 30 минутам"
        assert db_session.query(models.PrrLimit).count() == 0


def test_read_prr_limits(test_client, db_session):
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    prr_limit_1 = models.PrrLimit(object_id=test_object.id, duration_minutes=60)
    prr_limit_2 = models.PrrLimit(object_id=test_object.id, duration_minutes=90)
    db_session.add_all([prr_limit_1, prr_limit_2])
    db_session.commit()

    response = test_client.get("/api/prr-limits/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_update_prr_limit(test_client, db_session):
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    prr_limit = models.PrrLimit(object_id=test_object.id, duration_minutes=60)
    db_session.add(prr_limit)
    db_session.commit()

    update_data = {"duration_minutes": 90}
    response = test_client.put(f"/api/prr-limits/{prr_limit.id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["duration_minutes"] == 90


def test_update_prr_limit_invalid_duration(test_client, db_session):
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    prr_limit = models.PrrLimit(object_id=test_object.id, duration_minutes=60)
    db_session.add(prr_limit)
    db_session.commit()

    response = test_client.put(f"/api/prr-limits/{prr_limit.id}", json={"duration_minutes": 45})
    assert response.status_code == 400
    assert response.json()["detail"] == "Длительность должна быть неотрицательной и кратной 30 минутам"
    db_session.refresh(prr_limit)
    assert prr_limit.duration_minutes == 60


def test_delete_prr_limit(test_client, db_session):
    test_object = models.Object(name="Test Object", object_type="warehouse")
    db_session.add(test_object)
    db_session.commit()

    prr_limit = models.PrrLimit(object_id=test_object.id, duration_minutes=60)
    db_session.add(prr_limit)
    db_session.commit()

    response = test_client.delete(f"/api/prr-limits/{prr_limit.id}")
    assert response.status_code == 200

    response = test_client.get(f"/api/prr-limits/{prr_limit.id}")
    assert response.status_code == 404
