# Guía para ejecutar, probar y tomar capturas

Repositorio: **https://github.com/EnryuuLook51/SistemaLaboratorioUNS**.

La app tiene frontend React, API FastAPI y una base SQLite que se crea al iniciar. No hace falta instalar un servidor de base de datos. Los perfiles son de demostración local y permiten recorrer las acciones de cada actor.

## 1. Preparar el equipo

Instala:

- [Git](https://git-scm.com/downloads).
- [Node.js LTS](https://nodejs.org/en/download), versión 22 o superior recomendada.
- [Python](https://www.python.org/downloads/), versión 3.11 o superior. En Windows, activa «Add Python to PATH» durante la instalación.
- [uv](https://docs.astral.sh/uv/getting-started/installation/), gestor de dependencias Python.

Instalación de uv en **Windows, desde PowerShell**:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

En **Linux/macOS**:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Vuelve a abrir la terminal. Comprueba que `git --version`, `node --version`, `npm --version` y `uv --version` respondan correctamente. Se necesita Internet en el primer arranque para descargar dependencias.

## 2. Descargar y ejecutar

Clona por HTTPS: no necesitas configurar una llave SSH.

```bash
git clone https://github.com/EnryuuLook51/SistemaLaboratorioUNS.git
cd SistemaLaboratorioUNS
```

**Windows / PowerShell**:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

**Linux/macOS**:

```bash
bash start.sh
```

Espera hasta que aparezca `Uvicorn running on http://127.0.0.1:8000`. Abre **http://127.0.0.1:8000** en Chrome, Edge o Firefox. Mantén la terminal abierta durante las pruebas. Detén el servidor con `Ctrl+C`.

El primer inicio muestra **tres reservas confirmadas y dos solicitudes pendientes** en la semana actual. SQLite guarda todos los cambios; recargar la página no restablece los ejemplos. Si ya hay reservas, el arranque conserva esa programación.

La documentación interactiva de API está en **http://127.0.0.1:8000/api/docs**. Sus operaciones protegidas usan la sesión del navegador. Para POST/PATCH introduce `XMLHttpRequest` en el campo `x-requested-with` de Swagger.

## 3. Perfiles disponibles

Ingresa desde el login con un código de la tabla y la contraseña inicial **`Uns2026!`**. También se admite el correo de la cuenta. Para cambiar de rol, pulsa **Cerrar sesión** y vuelve a ingresar. Si se configuró `DEMO_PASSWORD` antes del primer inicio, usa esa contraseña en lugar de la predeterminada.

| Código | Persona / rol | Qué probar |
| --- | --- | --- |
| `DOC001` | María Torres / docente | Solicitar, editar y cancelar reservas propias. |
| `DEL001` | Luis Vega / delegado | Solicitar Sistemas de Información II con María Torres como responsable. |
| `ADM001` | Ana Rojas / administrador | Aprobar/rechazar, crear laboratorios y bloquear horarios. |
| `COO001` | Elena Paz / coordinador | Consultar reportes y autorizar cambios en reservas. |

## 4. Pruebas y capturas para el documento

Usa una ventana de navegador de aproximadamente **1440 × 900**, zoom 100 %. Espera a que termine la carga antes de tomar cada captura. Guarda las imágenes en una carpeta `capturas/` y escribe debajo de cada una el resultado observado. Los datos de los ejemplos son de demostración: no representan programación oficial de la UNS.

### Captura 01 — Agenda semanal

1. Entra como docente y abre **Reservas**.
2. Mantén «Todos los espacios» y la semana actual.
3. Captura el horario, sus bloques y el formulario lateral.

**Resultado esperado:** se ven tres clases confirmadas y el formulario «Nueva solicitud». Pie sugerido: *La agenda muestra la ocupación compartida por día, hora y laboratorio.*

### Captura 02 — Registro de una solicitud

1. Elige el **viernes de la semana mostrada**, laboratorio **LAB-A1**, de **09:00 a 10:00**.
2. Selecciona **Sistemas de Información II**, 20 participantes, y envía la solicitud.
3. Abre **Mis solicitudes** y captura la nueva fila con estado **Pendiente**.

**Resultado esperado:** la solicitud se guarda pero no ocupa el horario hasta aprobarse. Pie: *La reserva inicia como solicitud pendiente de revisión.*

### Captura 03 — Aprobación

Antes de aprobar, crea otra solicitud del mismo viernes y laboratorio, de **09:30 a 10:30**, 20 participantes. Esto prepara la prueba de conflicto.

1. Cambia a **administrador** y abre **Solicitudes**.
2. Aprueba únicamente la solicitud **09:00–10:00**.
3. Captura la fila **Confirmada**, con la otra aún **Pendiente**.

**Resultado esperado:** la primera reserva queda registrada como confirmada. Pie: *La administración aprueba una solicitud y consolida la programación.*

### Captura 04 — Conflicto de horario

1. Como administrador, intenta aprobar la solicitud **09:30–10:30**.
2. Captura el mensaje **«El horario ya no está disponible»**, junto con los estados de ambas solicitudes.

**Resultado esperado:** la segunda solicitud sigue pendiente y no se guarda una reserva confirmada superpuesta. Pie: *La API y SQLite rechazan la confirmación de una franja que cruza una reserva existente (HTTP 409).*

Esta prueba manual demuestra el rechazo de un cruce. La comprobación de solicitudes **simultáneas** está cubierta por la prueba automatizada; no describas esta captura manual como una prueba de carga ni como cien ejecuciones concurrentes.

### Captura 05 — Permisos del delegado

1. Cambia a **delegado**.
2. En el formulario elige **Sistemas de Información II**.
3. Captura el curso permitido y a **María Torres** como docente responsable.

**Resultado esperado:** el formulario ofrece solo la delegación autorizada. Pie: *El delegado registra solicitudes en representación de un curso y docente autorizado.*

Para demostrar una prohibición en el servidor, inicia sesión como `DOC001` y abre `/api/docs` en el mismo navegador. Usa `POST /reservas/{reservation_id}/aprobar`, el ID de una solicitud pendiente y `XMLHttpRequest` en `x-requested-with`. Captura **403 / «No tienes permiso para esta operación»**. Ocultar un botón en la interfaz por sí solo no demuestra autorización del backend.

### Captura 06 — Modificación o cancelación

1. Vuelve a **docente**, abre **Mis solicitudes** y pulsa **Editar** en la reserva confirmada del viernes.
2. Cambia su horario a **08:00–09:00**, guarda y captura la fila actualizada.
3. Si necesitas otra evidencia, pulsa **Cancelar**, confirma y captura el estado **Cancelada**.

**Resultado esperado:** los cambios se guardan; al cancelar se libera la franja. Pie: *El responsable puede modificar o cancelar sus propias reservas.*

### Captura 07 — Catálogo configurable

1. Como administrador, abre **Laboratorios → Nuevo laboratorio**.
2. Registra `LAB-D4`, «Laboratorio de Software», «Pabellón D · piso 1», capacidad 30 y «30 computadoras, proyector».
3. Captura la tarjeta del nuevo espacio. Si se requiere demostrar el requisito de cinco laboratorios, repite con códigos `LAB-E5`, `LAB-F6`, `LAB-G7` y `LAB-H8`.

**Resultado esperado:** aparecen nuevos espacios sin editar el código. Pie: *El catálogo permite incorporar laboratorios desde la interfaz administrativa.*

### Captura 08 — Reportes y vista móvil

1. Como coordinador, abre **Reportes** y captura el conteo por laboratorio.
2. Como docente, vuelve a **Reservas** y reduce la ventana o usa el modo de dispositivo del navegador a 390 px de ancho. Captura la agenda de un día.

**Resultado esperado:** los reportes usan reservas guardadas y la vista móvil conserva la lectura del horario. Pie: *La aplicación adapta la agenda para pantallas pequeñas.*

### Captura 09 — Pruebas automatizadas

Desde otra terminal en la raíz del repositorio:

```bash
uv run --locked --extra test pytest -q
```

Captura la salida de la ejecución y anota el resultado que obtengas. Las pruebas verifican login, sesiones, límites de intentos, protección CSRF, flujo, conflictos, autorizaciones, catálogo, confirmaciones simultáneas y privacidad de la agenda compartida. Usan una base temporal y no alteran la programación de tus capturas.

## 5. Repetir pruebas desde una base nueva

Detén el servidor. Elige un nombre nuevo de archivo para cada ronda; esto conserva la base anterior.

**Windows / PowerShell**:

```powershell
$env:RESERVAS_DB = "$PWD\data\pruebas-capturas-02.sqlite3"
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

**Linux/macOS**:

```bash
RESERVAS_DB="$PWD/data/pruebas-capturas-02.sqlite3" bash start.sh
```

Los archivos SQLite locales y las capturas no se suben a Git. El repositorio contiene el esquema, las migraciones y el seed para reproducirlos.

## 6. Si algo no arranca

- **`uv` o `npm` no encontrado:** instala el requisito y abre una terminal nueva.
- **Puerto 8000 ocupado:** detén la instancia anterior con `Ctrl+C` y vuelve a iniciar.
- **Agenda vacía tras cambiar de semana:** pulsa **Hoy**; los ejemplos se crean para la semana del primer arranque.
- **Solicitud sin botón habilitado:** selecciona laboratorio y curso, verifica capacidad y un horario disponible con término posterior al inicio.
- **Error al aprobar:** revisa cruces y bloqueos; una solicitud pendiente no garantiza que la franja siga libre.
- **Build fallido por la versión de Node:** usa Node.js LTS 22 o superior y vuelve a ejecutar el script.

Para actualizar el código compartido, detén el servidor, ejecuta `git pull` y vuelve a ejecutar el script de inicio.
