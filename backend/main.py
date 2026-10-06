"""API HTTP para el prototipo de reserva de laboratorios UNS."""

import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from .database import get_db, init_db

Db = Annotated[sqlite3.Connection, Depends(get_db)]
logger = logging.getLogger("reservas")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Reserva de Laboratorios · UNS", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "X-Demo-User"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    logger.info("%s %s %s %.1fms", request.method, request.url.path, response.status_code, (time.perf_counter() - start) * 1000)
    return response


def fail(code: int, detail: str):
    raise HTTPException(status_code=code, detail=detail)


def one(db: sqlite3.Connection, query: str, args: tuple = ()) -> dict:
    row = db.execute(query, args).fetchone()
    if row is None:
        fail(404, "Recurso no encontrado")
    return dict(row)


def all_rows(db: sqlite3.Connection, query: str, args: tuple = ()) -> list[dict]:
    return [dict(row) for row in db.execute(query, args)]


def actor(
    db: Db,
    request: Request,
    x_demo_user: Annotated[str | None, Header(description="Código de usuario demo; solo en modo local")] = None,
) -> dict:
    if os.environ.get("DEMO_MODE") != "1":
        fail(503, "Autenticación institucional pendiente. Inicia la API en modo demo local para pruebas.")
    if request.client is None or request.client.host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        fail(403, "El modo demo solo admite acceso local")
    if not x_demo_user:
        fail(401, "Indica X-Demo-User: DOC001, DEL001, ADM001 o COO001")
    row = db.execute(
        "SELECT * FROM usuarios WHERE codigo_institucional=? AND activo=1", (x_demo_user,)
    ).fetchone()
    if row is None:
        fail(401, "Usuario demo desconocido o inactivo")
    return dict(row)


Actor = Annotated[dict, Depends(actor)]


def permit(db: sqlite3.Connection, user: dict, allowed: bool, operation: str) -> None:
    if not allowed:
        with db:
            db.execute("INSERT INTO eventos_seguridad(usuario_id, accion) VALUES (?,?)", (user["id"], operation))
        fail(403, "No tienes permiso para esta operación")


def conflict(exc: sqlite3.IntegrityError) -> None:
    if "horario no disponible" in str(exc):
        fail(409, "El horario ya no está disponible")
    fail(409, "Los datos entran en conflicto con un registro existente")


Hora = Annotated[str, Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")]


class Franja(BaseModel):
    fecha: date
    inicio: Hora
    fin: Hora

    @model_validator(mode="after")
    def orden(self):
        if self.inicio >= self.fin:
            raise ValueError("La hora de término debe ser posterior al inicio")
        return self


class ReservaNueva(Franja):
    laboratorio_id: int = Field(gt=0)
    curso_id: int = Field(gt=0)
    responsable_id: int | None = Field(default=None, gt=0)
    participantes: int = Field(gt=0)


class ReservaCambio(BaseModel):
    laboratorio_id: int | None = Field(default=None, gt=0)
    fecha: date | None = None
    inicio: Hora | None = None
    fin: Hora | None = None
    participantes: int | None = Field(default=None, gt=0)


class LaboratorioNuevo(BaseModel):
    codigo: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=120)
    ubicacion: str = Field(min_length=1, max_length=120)
    capacidad: int = Field(gt=0)
    equipos: str = ""


class LaboratorioCambio(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    ubicacion: str | None = Field(default=None, min_length=1)
    capacidad: int | None = Field(default=None, gt=0)
    equipos: str | None = None
    activo: bool | None = None


class CursoNuevo(BaseModel):
    codigo: str = Field(min_length=1)
    nombre: str = Field(min_length=1)


class DelegacionNueva(BaseModel):
    curso_id: int = Field(gt=0)
    delegado_id: int = Field(gt=0)
    docente_id: int = Field(gt=0)


class BloqueoNuevo(Franja):
    laboratorio_id: int = Field(gt=0)
    motivo: str = Field(min_length=1)


def validate_lab(db: sqlite3.Connection, lab_id: int, participants: int | None = None) -> dict:
    lab = one(db, "SELECT * FROM laboratorios WHERE id=?", (lab_id,))
    if not lab["activo"]:
        fail(409, "Laboratorio fuera de servicio")
    if participants is not None and participants > lab["capacidad"]:
        fail(422, "La cantidad de participantes supera la capacidad del laboratorio")
    return lab


def reservation(db: sqlite3.Connection, reservation_id: int) -> dict:
    return one(
        db,
        """SELECT r.*, l.nombre AS laboratorio, c.nombre AS curso, u.nombre AS solicitante,
                  p.nombre AS responsable FROM reservas r
           JOIN laboratorios l ON l.id=r.laboratorio_id
           JOIN cursos c ON c.id=r.curso_id
           JOIN usuarios u ON u.id=r.solicitante_id
           JOIN usuarios p ON p.id=r.responsable_id WHERE r.id=?""",
        (reservation_id,),
    )


def audit(db: sqlite3.Connection, reservation_id: int, user_id: int, action: str, detail: str = "") -> None:
    db.execute(
        "INSERT INTO historial_reservas(reserva_id,actor_id,accion,detalle) VALUES (?,?,?,?)",
        (reservation_id, user_id, action, detail),
    )


def notify(db: sqlite3.Connection, reservation_id: int, user_id: int, message: str) -> None:
    db.execute(
        "INSERT INTO notificaciones(usuario_id,reserva_id,mensaje) VALUES (?,?,?)",
        (user_id, reservation_id, message),
    )


@app.get("/health", tags=["Sistema"])
def health(db: Db):
    db.execute("SELECT 1").fetchone()
    return {"estado": "ok"}


@app.get("/usuarios", tags=["Catálogo"])
def users(db: Db, user: Actor):
    return all_rows(db, "SELECT id,codigo_institucional,nombre,rol FROM usuarios WHERE activo=1 ORDER BY nombre")


@app.get("/usuarios/me", tags=["Sistema"])
def me(db: Db, user: Actor):
    return {key: user[key] for key in ("id", "codigo_institucional", "nombre", "correo", "rol")}


@app.get("/cursos", tags=["Catálogo"])
def courses(db: Db, user: Actor):
    return all_rows(db, "SELECT * FROM cursos ORDER BY nombre")


@app.post("/cursos", status_code=201, tags=["Catálogo"])
def create_course(data: CursoNuevo, db: Db, user: Actor):
    permit(db, user, user["rol"] == "administrador", "crear_curso")
    try:
        with db:
            rid = db.execute("INSERT INTO cursos(codigo,nombre) VALUES (?,?)", (data.codigo, data.nombre)).lastrowid
    except sqlite3.IntegrityError as exc:
        conflict(exc)
    return one(db, "SELECT * FROM cursos WHERE id=?", (rid,))


@app.get("/laboratorios", tags=["Catálogo"])
def labs(db: Db, user: Actor, incluir_inactivos: bool = False):
    permit(db, user, not incluir_inactivos or user["rol"] in ("administrador", "coordinador"), "ver_laboratorios_inactivos")
    return all_rows(db, "SELECT * FROM laboratorios WHERE activo=1 OR ? ORDER BY codigo", (int(incluir_inactivos),))


@app.post("/laboratorios", status_code=201, tags=["Catálogo"])
def create_lab(data: LaboratorioNuevo, db: Db, user: Actor):
    permit(db, user, user["rol"] == "administrador", "crear_laboratorio")
    try:
        with db:
            rid = db.execute(
                "INSERT INTO laboratorios(codigo,nombre,ubicacion,capacidad,equipos) VALUES (?,?,?,?,?)",
                (data.codigo, data.nombre, data.ubicacion, data.capacidad, data.equipos),
            ).lastrowid
    except sqlite3.IntegrityError as exc:
        conflict(exc)
    return one(db, "SELECT * FROM laboratorios WHERE id=?", (rid,))


@app.patch("/laboratorios/{lab_id}", tags=["Catálogo"])
def update_lab(lab_id: int, data: LaboratorioCambio, db: Db, user: Actor):
    permit(db, user, user["rol"] == "administrador", "editar_laboratorio")
    one(db, "SELECT id FROM laboratorios WHERE id=?", (lab_id,))
    changes = data.model_dump(exclude_unset=True)
    if changes:
        if "activo" in changes:
            changes["activo"] = int(changes["activo"])
        with db:
            db.execute(
                f"UPDATE laboratorios SET {', '.join(key + '=?' for key in changes)} WHERE id=?",
                (*changes.values(), lab_id),
            )
    return one(db, "SELECT * FROM laboratorios WHERE id=?", (lab_id,))


@app.post("/autorizaciones-curso", status_code=201, tags=["Catálogo"])
def delegate_course(data: DelegacionNueva, db: Db, user: Actor):
    permit(db, user, user["rol"] == "administrador", "autorizar_delegado")
    delegate = one(db, "SELECT rol FROM usuarios WHERE id=? AND activo=1", (data.delegado_id,))
    teacher = one(db, "SELECT rol FROM usuarios WHERE id=? AND activo=1", (data.docente_id,))
    if delegate["rol"] != "delegado" or teacher["rol"] != "docente":
        fail(422, "La autorización requiere un delegado y un docente activos")
    one(db, "SELECT id FROM cursos WHERE id=?", (data.curso_id,))
    with db:
        db.execute(
            "INSERT OR IGNORE INTO autorizaciones_curso(curso_id,delegado_id,docente_id) VALUES (?,?,?)",
            (data.curso_id, data.delegado_id, data.docente_id),
        )
    return data


@app.get("/autorizaciones-curso", tags=["Catálogo"])
def course_delegations(db: Db, user: Actor):
    """Opciones que un delegado puede usar sin probar permisos a ciegas."""
    permit(db, user, user["rol"] in ("delegado", "administrador"), "ver_delegaciones")
    query = """SELECT a.curso_id, a.delegado_id, a.docente_id, c.nombre AS curso,
                      u.nombre AS docente FROM autorizaciones_curso a
               JOIN cursos c ON c.id=a.curso_id JOIN usuarios u ON u.id=a.docente_id
               WHERE u.activo=1"""
    if user["rol"] == "delegado":
        return all_rows(db, query + " AND a.delegado_id=? ORDER BY c.nombre", (user["id"],))
    return all_rows(db, query + " ORDER BY c.nombre")


@app.get("/agenda", tags=["Reservas"])
def weekly_schedule(db: Db, user: Actor, desde: date, hasta: date, laboratorio_id: int | None = None):
    """Ocupación compartida: sin datos personales ni solicitudes ajenas pendientes."""
    if hasta < desde or hasta - desde > timedelta(days=13):
        fail(422, "Selecciona un rango de hasta 14 días")
    args: list[str | int] = [str(desde), str(hasta)]
    where_lab = ""
    if laboratorio_id is not None:
        where_lab = " AND r.laboratorio_id=?"
        args.append(laboratorio_id)
    reservations = all_rows(db, """SELECT r.id, r.laboratorio_id, l.codigo AS laboratorio_codigo,
                  l.nombre AS laboratorio, c.nombre AS curso, r.fecha, r.inicio, r.fin,
                  r.participantes, r.estado FROM reservas r
                  JOIN laboratorios l ON l.id=r.laboratorio_id
                  JOIN cursos c ON c.id=r.curso_id
                  WHERE r.estado='confirmada' AND r.fecha BETWEEN ? AND ?""" + where_lab +
                  " ORDER BY r.fecha, r.inicio", tuple(args))
    block_args: list[str | int] = [str(desde), str(hasta)]
    block_filter = ""
    if laboratorio_id is not None:
        block_filter = " AND b.laboratorio_id=?"
        block_args.append(laboratorio_id)
    blocks = all_rows(db, """SELECT b.id, b.laboratorio_id, l.codigo AS laboratorio_codigo,
                 l.nombre AS laboratorio, b.fecha, b.inicio, b.fin, b.motivo
                 FROM bloqueos b JOIN laboratorios l ON l.id=b.laboratorio_id
                 WHERE b.fecha BETWEEN ? AND ?""" + block_filter +
                 " ORDER BY b.fecha, b.inicio", tuple(block_args))
    return {"reservas": reservations, "bloqueos": blocks}


@app.get("/disponibilidad", tags=["Reservas"])
def availability(
    db: Db, user: Actor, fecha: date, inicio: Hora, fin: Hora,
    participantes: Annotated[int, Query(gt=0)] = 1,
):
    if inicio >= fin:
        fail(422, "La hora de término debe ser posterior al inicio")
    return all_rows(
        db,
        """SELECT l.* FROM laboratorios l WHERE l.activo=1 AND l.capacidad>=?
           AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.laboratorio_id=l.id AND r.fecha=?
                           AND r.estado='confirmada' AND ? < r.fin AND r.inicio < ?)
           AND NOT EXISTS (SELECT 1 FROM bloqueos b WHERE b.laboratorio_id=l.id AND b.fecha=?
                           AND ? < b.fin AND b.inicio < ?) ORDER BY l.codigo""",
        (participantes, str(fecha), inicio, fin, str(fecha), inicio, fin),
    )


@app.get("/reservas", tags=["Reservas"])
def reservations(db: Db, user: Actor, fecha: date | None = None, estado: str | None = None):
    if estado is not None and estado not in ("pendiente", "confirmada", "rechazada", "cancelada"):
        fail(422, "Estado desconocido")
    query = """SELECT r.*, l.nombre AS laboratorio, c.nombre AS curso, u.nombre AS solicitante,
                      p.nombre AS responsable FROM reservas r
               JOIN laboratorios l ON l.id=r.laboratorio_id JOIN cursos c ON c.id=r.curso_id
               JOIN usuarios u ON u.id=r.solicitante_id JOIN usuarios p ON p.id=r.responsable_id WHERE 1=1"""
    args = []
    if user["rol"] not in ("administrador", "coordinador"):
        query += " AND (r.solicitante_id=? OR r.responsable_id=?)"
        args += [user["id"], user["id"]]
    if fecha:
        query += " AND r.fecha=?"
        args.append(str(fecha))
    if estado:
        query += " AND r.estado=?"
        args.append(estado)
    return all_rows(db, query + " ORDER BY r.fecha DESC, r.inicio, r.id DESC", tuple(args))


@app.post("/reservas", status_code=201, tags=["Reservas"])
def create_reservation(data: ReservaNueva, db: Db, user: Actor):
    permit(db, user, user["rol"] in ("docente", "delegado"), "crear_reserva")
    validate_lab(db, data.laboratorio_id, data.participantes)
    one(db, "SELECT id FROM cursos WHERE id=?", (data.curso_id,))
    responsible = data.responsable_id or user["id"]
    if user["rol"] == "docente":
        permit(db, user, responsible == user["id"], "suplantar_responsable")
    else:
        permit(
            db, user,
            bool(db.execute(
                """SELECT 1 FROM autorizaciones_curso a JOIN usuarios u ON u.id=a.docente_id
                   WHERE a.curso_id=? AND a.delegado_id=? AND a.docente_id=? AND u.activo=1""",
                (data.curso_id, user["id"], responsible),
            ).fetchone()),
            "solicitar_sin_delegacion",
        )
    with db:
        rid = db.execute(
            """INSERT INTO reservas(laboratorio_id,curso_id,solicitante_id,responsable_id,
                                    fecha,inicio,fin,participantes) VALUES (?,?,?,?,?,?,?,?)""",
            (data.laboratorio_id, data.curso_id, user["id"], responsible, str(data.fecha), data.inicio, data.fin, data.participantes),
        ).lastrowid
        audit(db, rid, user["id"], "solicitada")
        notify(db, rid, responsible, "Se registró una solicitud de reserva pendiente")
    return reservation(db, rid)


@app.get("/reservas/{reservation_id}", tags=["Reservas"])
def get_reservation(reservation_id: int, db: Db, user: Actor):
    row = reservation(db, reservation_id)
    permit(db, user, user["rol"] in ("administrador", "coordinador") or user["id"] in (row["solicitante_id"], row["responsable_id"]), "leer_reserva_ajena")
    return row


@app.patch("/reservas/{reservation_id}", tags=["Reservas"])
def change_reservation(reservation_id: int, data: ReservaCambio, db: Db, user: Actor):
    row = reservation(db, reservation_id)
    permit(db, user, user["rol"] in ("administrador", "coordinador") or (user["rol"] == "docente" and row["responsable_id"] == user["id"]), "editar_reserva_ajena")
    if row["estado"] not in ("pendiente", "confirmada"):
        fail(409, "Solo se pueden modificar reservas pendientes o confirmadas")
    changes = data.model_dump(exclude_unset=True)
    if changes:
        updated = {**row, **changes}
        if updated["inicio"] >= updated["fin"]:
            fail(422, "La hora de término debe ser posterior al inicio")
        if "fecha" in changes:
            changes["fecha"] = str(changes["fecha"])
        try:
            with db:
                db.execute("BEGIN IMMEDIATE")
                validate_lab(db, updated["laboratorio_id"], updated["participantes"])
                cursor = db.execute(
                    f"UPDATE reservas SET {', '.join(key + '=?' for key in changes)}, actualizada_en=CURRENT_TIMESTAMP WHERE id=? AND estado=?",
                    (*changes.values(), reservation_id, row["estado"]),
                )
                if cursor.rowcount != 1:
                    fail(409, "La solicitud cambió mientras se procesaba")
                audit(db, reservation_id, user["id"], "modificada", ", ".join(changes))
                notify(db, reservation_id, row["responsable_id"], "Tu reserva fue modificada")
        except sqlite3.IntegrityError as exc:
            conflict(exc)
    return reservation(db, reservation_id)


def set_status(db: sqlite3.Connection, user: dict, reservation_id: int, target: str) -> dict:
    row = reservation(db, reservation_id)
    if target in ("confirmada", "rechazada"):
        permit(db, user, user["rol"] == "administrador", "resolver_solicitud_sin_permiso")
        if row["estado"] != "pendiente":
            fail(409, "Solo se pueden resolver solicitudes pendientes")
    else:
        permit(db, user, user["rol"] in ("administrador", "coordinador") or (user["rol"] == "docente" and row["responsable_id"] == user["id"]), "cancelar_reserva_ajena")
        if row["estado"] not in ("pendiente", "confirmada"):
            fail(409, "La solicitud ya está cerrada")
    try:
        with db:
            db.execute("BEGIN IMMEDIATE")
            if target == "confirmada":
                validate_lab(db, row["laboratorio_id"], row["participantes"])
            cursor = db.execute(
                "UPDATE reservas SET estado=?, actualizada_en=CURRENT_TIMESTAMP WHERE id=? AND estado=?",
                (target, reservation_id, row["estado"]),
            )
            if cursor.rowcount != 1:
                fail(409, "La solicitud cambió mientras se procesaba")
            audit(db, reservation_id, user["id"], target)
            notify(db, reservation_id, row["responsable_id"], f"Tu solicitud fue {target}")
            if row["solicitante_id"] != row["responsable_id"]:
                notify(db, reservation_id, row["solicitante_id"], f"Tu solicitud fue {target}")
    except sqlite3.IntegrityError as exc:
        conflict(exc)
    return reservation(db, reservation_id)


@app.post("/reservas/{reservation_id}/aprobar", tags=["Reservas"])
def approve(reservation_id: int, db: Db, user: Actor):
    return set_status(db, user, reservation_id, "confirmada")


@app.post("/reservas/{reservation_id}/rechazar", tags=["Reservas"])
def reject(reservation_id: int, db: Db, user: Actor):
    return set_status(db, user, reservation_id, "rechazada")


@app.post("/reservas/{reservation_id}/cancelar", tags=["Reservas"])
def cancel(reservation_id: int, db: Db, user: Actor):
    return set_status(db, user, reservation_id, "cancelada")


@app.post("/bloqueos", status_code=201, tags=["Reservas"])
def create_block(data: BloqueoNuevo, db: Db, user: Actor):
    permit(db, user, user["rol"] == "administrador", "bloquear_horario")
    validate_lab(db, data.laboratorio_id)
    try:
        with db:
            db.execute("BEGIN IMMEDIATE")
            rid = db.execute(
                "INSERT INTO bloqueos(laboratorio_id,fecha,inicio,fin,motivo,creado_por_id) VALUES (?,?,?,?,?,?)",
                (data.laboratorio_id, str(data.fecha), data.inicio, data.fin, data.motivo, user["id"]),
            ).lastrowid
    except sqlite3.IntegrityError as exc:
        conflict(exc)
    return one(db, "SELECT * FROM bloqueos WHERE id=?", (rid,))


@app.get("/bloqueos", tags=["Reservas"])
def blocks(db: Db, user: Actor, fecha: date | None = None):
    return all_rows(db, "SELECT * FROM bloqueos WHERE (? IS NULL OR fecha=?) ORDER BY fecha,inicio", (str(fecha) if fecha else None, str(fecha) if fecha else None))


@app.get("/reservas/{reservation_id}/historial", tags=["Reservas"])
def history(reservation_id: int, db: Db, user: Actor):
    row = reservation(db, reservation_id)
    permit(db, user, user["rol"] in ("administrador", "coordinador") or user["id"] in (row["solicitante_id"], row["responsable_id"]), "leer_historial_ajeno")
    return all_rows(db, "SELECT * FROM historial_reservas WHERE reserva_id=? ORDER BY id", (reservation_id,))


@app.get("/notificaciones", tags=["Sistema"])
def notifications(db: Db, user: Actor):
    return all_rows(db, "SELECT * FROM notificaciones WHERE usuario_id=? ORDER BY id DESC LIMIT 100", (user["id"],))


@app.get("/reportes/uso", tags=["Sistema"])
def report(db: Db, user: Actor):
    permit(db, user, user["rol"] in ("administrador", "coordinador"), "ver_reporte")
    return all_rows(db, """SELECT l.id, l.codigo, l.nombre,
          COUNT(r.id) AS reservas_confirmadas FROM laboratorios l
          LEFT JOIN reservas r ON r.laboratorio_id=l.id AND r.estado='confirmada'
          GROUP BY l.id ORDER BY l.codigo""")
