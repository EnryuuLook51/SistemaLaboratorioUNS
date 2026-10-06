#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v uv >/dev/null || { echo "Instala uv siguiendo docs/guia-companero.md"; exit 1; }
command -v npm >/dev/null || { echo "Instala Node.js LTS siguiendo docs/guia-companero.md"; exit 1; }
uv sync --locked
npm --prefix frontend ci
npm --prefix frontend run build
uv run --locked python -m backend.seed --agenda
export DEMO_MODE=1
exec uv run --locked uvicorn backend.web:app --host 127.0.0.1 --port 8000
