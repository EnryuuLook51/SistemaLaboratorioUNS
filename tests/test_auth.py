import pytest
from fastapi.testclient import TestClient

from backend.auth import hash_password, verify_password
from backend.database import ROOT, connect, init_db
from backend.main import app
from backend.seed import seed

HEADERS = {"X-Requested-With": "XMLHttpRequest"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("RESERVAS_DB", str(tmp_path / "auth.sqlite3"))
    monkeypatch.setenv("DEMO_PASSWORD", "Uns2026!")
    monkeypatch.delenv("COOKIE_SECURE", raising=False)
    seed()
    with TestClient(app) as client:
        yield client


def login(client, identifier="DOC001", password="Uns2026!"):
    return client.post("/auth/login", headers=HEADERS, json={"identificador": identifier, "password": password})


def test_passwords_are_salted():
    first, second = hash_password("Uns2026!"), hash_password("Uns2026!")
    assert first != second
    assert verify_password("Uns2026!", first)
    assert not verify_password("wrong", first)


def test_login_cookie_logout_and_revocation(client):
    assert client.get("/usuarios/me").status_code == 401
    response = login(client, "  maria.torres@UNS.edu.pe  ")
    assert response.status_code == 200
    assert response.json()["rol"] == "docente"
    assert "password_hash" not in response.json()
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "samesite=lax" in response.headers["set-cookie"].lower()
    assert client.get("/usuarios/me").json()["codigo_institucional"] == "DOC001"
    token = client.cookies["uns_session"]
    with connect() as db:
        assert db.execute("SELECT token_hash FROM sesiones").fetchone()[0] != token
    assert client.post("/auth/logout", headers=HEADERS).status_code == 200
    assert client.get("/usuarios/me", headers={"Cookie": f"uns_session={token}"}).status_code == 401
    assert client.post("/auth/logout", headers=HEADERS).status_code == 200


def test_bad_credentials_and_throttling(client):
    for _ in range(5):
        assert login(client, password="incorrecta").status_code == 401
    response = login(client)
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) > 0
    with connect() as db:
        db.execute("UPDATE intentos_login SET expira_en=0")
    assert login(client).status_code == 200


def test_unknown_and_inactive_users(client):
    assert login(client, "UNKNOWN").status_code == 401
    with connect() as db:
        db.execute("UPDATE usuarios SET activo=0 WHERE codigo_institucional='DOC001'")
    assert login(client).status_code == 401


def test_expired_forged_and_inactive_sessions(client):
    assert client.get("/usuarios/me", headers={"Cookie": "uns_session=forged"}).status_code == 401
    assert login(client).status_code == 200
    with connect() as db:
        db.execute("UPDATE sesiones SET expira_en=0")
    assert client.get("/usuarios/me").status_code == 401
    assert login(client).status_code == 200
    with connect() as db:
        db.execute("UPDATE usuarios SET activo=0 WHERE codigo_institucional='DOC001'")
    assert client.get("/usuarios/me").status_code == 401


def test_csrf_and_session_rotation(client):
    assert client.post("/auth/login", json={"identificador": "DOC001", "password": "Uns2026!"}).status_code == 403
    assert login(client).status_code == 200
    previous = client.cookies["uns_session"]
    assert client.post("/auth/logout").status_code == 403
    assert login(client, "ADM001").status_code == 200
    assert client.get("/usuarios/me").json()["rol"] == "administrador"
    assert client.get("/usuarios/me", headers={"Cookie": f"uns_session={previous}"}).status_code == 401
    preflight = client.options("/auth/logout", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-Requested-With"})
    assert "access-control-allow-origin" not in preflight.headers


def test_seed_preserves_passwords_and_reservations(client):
    with connect() as db:
        before = db.execute("SELECT password_hash FROM usuarios WHERE id=1").fetchone()[0]
    seed()
    with connect() as db:
        assert db.execute("SELECT password_hash FROM usuarios WHERE id=1").fetchone()[0] == before


def test_secure_cookie(client, monkeypatch):
    monkeypatch.setenv("COOKIE_SECURE", "1")
    assert "secure" in login(client).headers["set-cookie"].lower()


def test_migrates_existing_database_without_losing_data(tmp_path, monkeypatch):
    monkeypatch.setenv("RESERVAS_DB", str(tmp_path / "existing.sqlite3"))
    with connect() as db:
        db.executescript((ROOT / "db/schema.sql").read_text())
        db.executescript((ROOT / "db/migrations/002_autorizaciones.sql").read_text())
        db.execute("PRAGMA user_version=2")
        db.execute("INSERT INTO usuarios(id,codigo_institucional,nombre,correo,rol) VALUES (42,'OLD','Existente','old@uns.edu.pe','docente')")
    init_db()
    init_db()
    with connect() as db:
        row = db.execute("SELECT * FROM usuarios WHERE id=42").fetchone()
        assert row["nombre"] == "Existente"
        assert row["password_hash"] is None
        assert db.execute("PRAGMA user_version").fetchone()[0] == 3
