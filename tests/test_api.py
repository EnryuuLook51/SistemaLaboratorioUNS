from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.database import connect
from backend.main import app
from backend.seed import seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("RESERVAS_DB", str(tmp_path / "reservas.sqlite3"))
    monkeypatch.setenv("DEMO_MODE", "1")
    seed()
    with TestClient(app, base_url="http://localhost") as test_client:
        yield test_client


def call(client, method, path, who="DOC001", **kwargs):
    return client.request(method, path, headers={"X-Demo-User": who}, **kwargs)


def request_payload(**changes):
    return {
        "laboratorio_id": 1, "curso_id": 1,
        "fecha": (date.today() + timedelta(days=7)).isoformat(),
        "inicio": "09:00", "fin": "10:00", "participantes": 20,
        **changes,
    }


def test_workflow_conflicts_and_notifications(client):
    first = call(client, "POST", "/reservas", json=request_payload())
    assert first.status_code == 201, first.text
    second = call(client, "POST", "/reservas", json=request_payload(inicio="09:30", fin="10:30"))
    assert second.status_code == 201
    a, b = first.json()["id"], second.json()["id"]

    assert call(client, "POST", f"/reservas/{a}/aprobar", who="DOC001").status_code == 403
    assert call(client, "POST", f"/reservas/{a}/aprobar", who="ADM001").status_code == 200
    rejected = call(client, "POST", f"/reservas/{b}/aprobar", who="ADM001")
    assert rejected.status_code == 409
    assert call(client, "GET", f"/reservas/{b}").json()["estado"] == "pendiente"

    available = call(client, "GET", "/disponibilidad", params={
        "fecha": request_payload()["fecha"], "inicio": "09:45", "fin": "10:15",
    }).json()
    assert 1 not in [lab["id"] for lab in available]
    assert call(client, "PATCH", f"/reservas/{a}", json={"fin": "10:30"}).status_code == 200
    assert call(client, "POST", f"/reservas/{a}/cancelar").json()["estado"] == "cancelada"
    assert call(client, "POST", f"/reservas/{b}/aprobar", who="ADM001").json()["estado"] == "confirmada"
    assert len(call(client, "GET", f"/reservas/{a}/historial").json()) == 4
    assert call(client, "GET", "/notificaciones").json()


def test_delegation_permissions_and_blocking(client):
    payload = request_payload(responsable_id=1)
    own = call(client, "POST", "/reservas", who="DEL001", json=payload)
    assert own.status_code == 201
    rid = own.json()["id"]
    assert call(client, "PATCH", f"/reservas/{rid}", who="DEL001", json={"inicio": "08:00"}).status_code == 403
    assert call(client, "PATCH", f"/reservas/{rid}", who="DOC001", json={"inicio": "08:00"}).status_code == 200
    assert call(client, "GET", "/reportes/uso", who="DOC001").status_code == 403
    assert call(client, "GET", "/reportes/uso", who="COO001").status_code == 200
    assert call(client, "POST", f"/reservas/{rid}/aprobar", who="ADM001").status_code == 200

    block = call(client, "POST", "/bloqueos", who="ADM001", json={
        "laboratorio_id": 1, "fecha": payload["fecha"],
        "inicio": "08:30", "fin": "09:30", "motivo": "Mantenimiento",
    })
    assert block.status_code == 409
    assert call(client, "POST", "/bloqueos", who="ADM001", json={
        "laboratorio_id": 1, "fecha": payload["fecha"],
        "inicio": "10:00", "fin": "11:00", "motivo": "Mantenimiento",
    }).status_code == 201
    assert call(client, "PATCH", f"/reservas/{rid}", who="DOC001", json={"fin": "10:30"}).status_code == 409
    with connect() as db:
        assert db.execute("SELECT COUNT(*) FROM eventos_seguridad").fetchone()[0] >= 2
        assert db.execute("SELECT COUNT(*) FROM historial_reservas WHERE reserva_id=?", (rid,)).fetchone()[0] == 3


def test_validation_and_catalog(client):
    assert call(client, "POST", "/reservas", json=request_payload(inicio="10:00", fin="09:00")).status_code == 422
    assert call(client, "POST", "/reservas", json=request_payload(participantes=999)).status_code == 422
    assert call(client, "POST", "/reservas", who="DEL001", json=request_payload(responsable_id=1, curso_id=2)).status_code == 403
    assert call(client, "POST", "/laboratorios", json={
        "codigo": "LAB-D4", "nombre": "Nuevo", "ubicacion": "A", "capacidad": 20,
    }).status_code == 403
    assert call(client, "POST", "/laboratorios", who="ADM001", json={
        "codigo": "LAB-D4", "nombre": "Nuevo", "ubicacion": "A", "capacidad": 20,
    }).status_code == 201
    assert len(call(client, "GET", "/laboratorios").json()) == 4


def test_simultaneous_approvals(client):
    ids = [call(client, "POST", "/reservas", json=request_payload()).json()["id"] for _ in range(2)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda rid: call(client, "POST", f"/reservas/{rid}/aprobar", who="ADM001").status_code, ids))
    assert sorted(results) == [200, 409]


def test_no_demo_authentication(tmp_path, monkeypatch):
    monkeypatch.setenv("RESERVAS_DB", str(tmp_path / "reservas.sqlite3"))
    monkeypatch.delenv("DEMO_MODE", raising=False)
    with TestClient(app, base_url="http://localhost") as client:
        assert client.get("/laboratorios", headers={"X-Demo-User": "ADM001"}).status_code == 503


def test_shared_schedule_hides_other_users_and_pending_requests(client):
    payload = request_payload(responsable_id=1)
    assert len(call(client, "GET", "/autorizaciones-curso", who="DEL001").json()) == 1
    own = call(client, "POST", "/reservas", who="DEL001", json=payload).json()
    params = {"desde": payload["fecha"], "hasta": payload["fecha"]}
    assert call(client, "GET", "/agenda", params=params).json()["reservas"] == []
    call(client, "POST", f"/reservas/{own['id']}/aprobar", who="ADM001")
    schedule = call(client, "GET", "/agenda", params=params).json()
    assert len(schedule["reservas"]) == 1
    assert schedule["reservas"][0]["laboratorio_id"] == 1
    assert "responsable_id" not in schedule["reservas"][0]
    assert "solicitante" not in schedule["reservas"][0]
    assert call(client, "GET", "/agenda", params={"desde": "2026-01-01", "hasta": "2026-02-01"}).status_code == 422
