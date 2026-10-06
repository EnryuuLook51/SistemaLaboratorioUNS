"""Conexiones cortas y migraciones SQLite, sin servidor adicional."""

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "reservas.sqlite3"


def database_path() -> Path:
    return Path(os.environ.get("RESERVAS_DB", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    # Las dependencias y rutas síncronas de FastAPI pueden correr en hilos distintos.
    db = sqlite3.connect(database_path(), timeout=5, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA busy_timeout = 5000")
    return db


def init_db() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='usuarios'").fetchone():
            db.executescript((ROOT / "db" / "schema.sql").read_text())
        if db.execute("PRAGMA user_version").fetchone()[0] < 2:
            db.executescript((ROOT / "db" / "migrations" / "002_autorizaciones.sql").read_text())
            db.execute("PRAGMA user_version = 2")
        db.execute("PRAGMA journal_mode = WAL")


def get_db() -> Iterator[sqlite3.Connection]:
    db = connect()
    try:
        yield db
    finally:
        db.close()
