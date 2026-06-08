import importlib
import sys

from fastapi.testclient import TestClient


def reload_main(monkeypatch, origins=None):
    import app.db as db

    monkeypatch.setattr(db.Base.metadata, "create_all", lambda bind: None)
    if origins is None:
        monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("FRONTEND_ORIGINS", origins)

    sys.modules.pop("app.main", None)
    import app.main as main
    return importlib.reload(main)


def test_health_endpoint_returns_ok(monkeypatch):
    main = reload_main(monkeypatch)

    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_frontend_origins_can_be_configured_from_env(monkeypatch):
    main = reload_main(
        monkeypatch,
        "http://158.160.94.205:5173, http://158.160.94.205:15173",
    )

    assert main.FRONTEND_ORIGINS == [
        "http://158.160.94.205:5173",
        "http://158.160.94.205:15173",
    ]
