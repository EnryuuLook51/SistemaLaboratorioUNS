"""Servidor de pruebas de navegador con una base temporal independiente."""

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import uvicorn
from backend.seed import seed_agenda


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="uns-e2e-", dir="/tmp/opencode" if Path("/tmp/opencode").exists() else None) as folder:
        os.environ["RESERVAS_DB"] = str(Path(folder) / "reservas.sqlite3")
        os.environ["DEMO_PASSWORD"] = "Uns2026!"
        seed_agenda()
        uvicorn.run("backend.web:app", host="127.0.0.1", port=8001)
