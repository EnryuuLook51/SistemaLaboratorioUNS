"""Datos de prueba reutilizables para el modo demo local."""

import argparse
import os
from datetime import date, timedelta

from .database import connect, init_db
from .auth import hash_password


def seed() -> None:
    init_db()
    with connect() as db:
        db.executemany(
            "INSERT OR IGNORE INTO usuarios(codigo_institucional,nombre,correo,rol) VALUES (?,?,?,?)",
            [
                ("DOC001", "María Torres", "maria.torres@uns.edu.pe", "docente"),
                ("DEL001", "Luis Vega", "luis.vega@uns.edu.pe", "delegado"),
                ("ADM001", "Ana Rojas", "ana.rojas@uns.edu.pe", "administrador"),
                ("COO001", "Elena Paz", "elena.paz@uns.edu.pe", "coordinador"),
            ],
        )
        db.executemany(
            "INSERT OR IGNORE INTO laboratorios(codigo,nombre,ubicacion,capacidad,equipos) VALUES (?,?,?,?,?)",
            [
                ("LAB-A1", "Laboratorio de Informática A1", "Pabellón A · piso 1", 30, "30 computadoras, proyector"),
                ("LAB-B2", "Laboratorio de Redes B2", "Pabellón B · piso 2", 24, "24 computadoras, equipamiento de redes"),
                ("LAB-C3", "Laboratorio Multimedia C3", "Pabellón C · piso 1", 36, "36 computadoras, proyector"),
            ],
        )
        # Solo las cuentas de ejemplo sin contraseña; nunca sobrescribir credenciales existentes.
        for code in ("DOC001", "DEL001", "ADM001", "COO001"):
            db.execute("UPDATE usuarios SET password_hash=? WHERE codigo_institucional=? AND password_hash IS NULL",
                       (hash_password(os.environ.get("DEMO_PASSWORD", "Uns2026!")), code))
        db.executemany(
            "INSERT OR IGNORE INTO cursos(codigo,nombre) VALUES (?,?)",
            [("SI-II", "Sistemas de Información II"), ("REDES-I", "Redes I")],
        )
        db.execute(
            """INSERT OR IGNORE INTO autorizaciones_curso(curso_id,delegado_id,docente_id)
               SELECT c.id, d.id, p.id FROM cursos c, usuarios d, usuarios p
               WHERE c.codigo='SI-II' AND d.codigo_institucional='DEL001'
                 AND p.codigo_institucional='DOC001'"""
        )


def seed_agenda() -> None:
    """Ejemplos reales en la semana actual, solo si la base no contiene reservas."""
    seed()
    with connect() as db:
        if db.execute("SELECT 1 FROM reservas LIMIT 1").fetchone():
            print("La base ya tiene reservas; no se añade programación de ejemplo.")
            return
        monday = date.today() - timedelta(days=date.today().weekday())
        user_id = db.execute("SELECT id FROM usuarios WHERE codigo_institucional='DOC001'").fetchone()[0]
        admin_id = db.execute("SELECT id FROM usuarios WHERE codigo_institucional='ADM001'").fetchone()[0]
        courses = {row['codigo']: row['id'] for row in db.execute("SELECT id,codigo FROM cursos")}
        labs = {row['codigo']: row['id'] for row in db.execute("SELECT id,codigo FROM laboratorios")}
        examples = [
            ("LAB-A1", "SI-II", 0, "08:00", "10:00", 28, "confirmada"),
            ("LAB-B2", "REDES-I", 1, "09:00", "11:00", 24, "confirmada"),
            ("LAB-C3", "SI-II", 2, "10:00", "12:00", 30, "confirmada"),
            ("LAB-A1", "SI-II", 3, "14:00", "16:00", 26, "pendiente"),
            ("LAB-B2", "REDES-I", 4, "11:00", "13:00", 20, "pendiente"),
        ]
        for lab, course, day, start, end, people, status in examples:
            rid = db.execute(
                """INSERT INTO reservas(laboratorio_id,curso_id,solicitante_id,responsable_id,
                                       fecha,inicio,fin,participantes,estado) VALUES (?,?,?,?,?,?,?,?,?)""",
                (labs[lab], courses[course], user_id, user_id, (monday + timedelta(days=day)).isoformat(), start, end, people, status),
            ).lastrowid
            db.execute("INSERT INTO historial_reservas(reserva_id,actor_id,accion,detalle) VALUES (?,?,?,?)", (rid, user_id, "solicitada", "Ejemplo de la agenda demo"))
            if status == 'confirmada':
                db.execute("INSERT INTO historial_reservas(reserva_id,actor_id,accion,detalle) VALUES (?,?,?,?)", (rid, admin_id, "confirmada", "Ejemplo de la agenda demo"))
            db.execute("INSERT INTO notificaciones(usuario_id,reserva_id,mensaje) VALUES (?,?,?)", (user_id, rid, f"Solicitud de demostración: {status}"))
    print("Agenda de ejemplo añadida para la semana actual.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--agenda", action="store_true", help="Añade programación de ejemplo solo sobre una base sin reservas")
    args = parser.parse_args()
    seed_agenda() if args.agenda else seed()
    print("Datos demo listos. Códigos: DOC001, DEL001, ADM001, COO001")
