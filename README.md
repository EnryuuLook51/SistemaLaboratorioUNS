# Reserva de Laboratorios · UNS

Aplicación **React + TypeScript + FastAPI + SQLite**. El diseño sigue el [horario semanal de referencia](docs/referencias/1.png): agenda clara, filtros y formulario de solicitud lateral. Incluye catálogo de laboratorios, solicitudes por rol, reportes y notificaciones.

**Para el compañero que realizará las pruebas y las capturas:** sigue la [guía de ejecución y evidencias para el informe](docs/guia-companero.md), con pasos para Windows y Linux/macOS y un guion de nueve grupos de capturas.

## Descargar

```bash
git clone https://github.com/EnryuuLook51/SistemaLaboratorioUNS.git
cd SistemaLaboratorioUNS
```

El contenido de `app/` en el espacio de trabajo original es la raíz de este repositorio.

## Iniciar la aplicación completa

Requisitos: Python ≥ 3.11, [uv](https://docs.astral.sh/uv/) y Node.js ≥ 20.19 (LTS 22 o superior recomendada). Desde la raíz del repositorio:

**Linux/macOS:**

```bash
./start.sh
```

**Windows / PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

El script instala dependencias, compila el frontend, prepara SQLite y sirve todo en **http://127.0.0.1:8000**. La documentación de API está en **http://127.0.0.1:8000/api/docs**. Detener con `Ctrl+C`.

Para volver a iniciar sin instalar ni compilar:

```bash
DEMO_MODE=1 uv run uvicorn backend.web:app --host 127.0.0.1 --port 8000
```

El seed conserva los datos existentes. Si aún no hay reservas, `--agenda` añade cinco actividades de ejemplo para la semana actual, tres confirmadas y dos pendientes. Son registros reales de demostración en SQLite, no cifras simuladas en el frontend.

## Prueba manual del flujo

En la barra «Prueba local» puedes elegir el perfil:

| Código | Perfil | Acciones |
| --- | --- | --- |
| `DOC001` | María Torres · docente | Solicitar, editar y cancelar sus reservas. |
| `DEL001` | Luis Vega · delegado | Solicitar para Sistemas de Información II con un docente autorizado. |
| `ADM001` | Ana Rojas · administrador | Aprobar/rechazar, bloquear horarios y administrar laboratorios. |
| `COO001` | Elena Paz · coordinador | Consultar solicitudes y reportes, modificar o cancelar reservas. |

1. Como **docente**, pulsa una hora de la agenda, elige laboratorio y curso, y envía una solicitud. La disponibilidad se consulta automáticamente; una solicitud pendiente todavía no ocupa la franja.
2. Ve a **Mis solicitudes** para comprobar el estado pendiente.
3. Cambia a **administrador**, abre **Solicitudes** y aprueba la reserva. Ahora aparece en el horario semanal compartido.
4. Para probar concurrencia manual: crea **dos solicitudes cruzadas antes de aprobarlas**, en el mismo laboratorio. Aprueba una; al intentar aprobar la otra verás «El horario ya no está disponible» (HTTP 409).
5. Vuelve al perfil docente para editar o cancelar la reserva. Los cambios se guardan en SQLite, se registran en el historial y generan notificaciones.
6. Como administrador, añade un laboratorio desde **Laboratorios** o registra mantenimiento con **Bloquear horario**. No puede cruzar una reserva confirmada.

El calendario distribuye actividades coincidentes de diferentes laboratorios en columnas dentro del mismo día. Para inspeccionar un único espacio, usa el filtro de laboratorio. En móvil se muestra un día seleccionable a la vez, incluidos sábado y domingo.

`DEMO_MODE=1` es un acceso de prueba local con `X-Demo-User`; la autenticación institucional todavía está pendiente. La base vive en `data/reservas.sqlite3`. Puedes usar otra sin tocarla con `RESERVAS_DB=/ruta/a/otra.sqlite3`, tanto para el seed como para el servidor.

## Desarrollo con recarga automática

En dos terminales, desde la raíz del repositorio:

```bash
# Terminal 1: API
uv sync --extra test
uv run python -m backend.seed --agenda
DEMO_MODE=1 uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: frontend
npm --prefix frontend ci
npm --prefix frontend run dev
```

Visita **http://127.0.0.1:5173**. Vite redirige `/api` al backend. En este modo, Swagger está en `http://127.0.0.1:8000/docs`.

## Verificar

```bash
uv run --extra test pytest -q
npm --prefix frontend run build
```

Hay una prueba de navegador del flujo completo en `scripts/browser_check.cjs`. Usa Playwright instalado aparte para no añadirlo al arranque normal. Por ejemplo, instalarlo en una carpeta temporal y ejecutar su navegador Chromium:

```bash
npm install --prefix /tmp/opencode/uns-browser playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/pw-browsers /tmp/opencode/uns-browser/node_modules/.bin/playwright install chromium
```

Después, en dos terminales desde la raíz del repositorio:

```bash
# Terminal 1: backend + frontend compilado sobre una base temporal nueva
uv run python scripts/e2e_server.py
```

```bash
# Terminal 2: recorrido de navegador
PLAYWRIGHT_MODULE=/tmp/opencode/uns-browser/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/pw-browsers node scripts/browser_check.cjs
```

Las pruebas de API y navegador usan bases temporales. Para repetir el recorrido de navegador, reinicia `e2e_server.py` y obtendrás otra base limpia.

## Archivos principales

- [Dirección visual](docs/direccion-visual.md) y [stack](docs/stack.md).
- [Guía para pruebas y capturas](docs/guia-companero.md) y [diagrama de arquitectura](docs/diagrama-estatico.html).
- [Frontend](frontend/src/App.tsx), [agenda](frontend/src/Calendar.tsx), [formulario](frontend/src/Booking.tsx) y [estilos](frontend/src/style.css).
- [API](backend/main.py) y [servidor integrado](backend/web.py).
- [Esquema SQLite](db/schema.sql) y [migración de autorizaciones](db/migrations/002_autorizaciones.sql).
- [Prototipos HTML previos](prototypes/index.html).
