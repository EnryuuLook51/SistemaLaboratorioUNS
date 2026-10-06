# Stack propuesto · Reserva de Laboratorios UNS

## Alcance y fuentes

Basado en el caso académico «Práctica 2: Reserva de Laboratorios UNS» y en el [diagrama de arquitectura](diagrama-estatico.html). El flujo es: docente/delegado/administrador/coordinador → interfaz web → API de reservas y permisos → SQLite; las notificaciones y el monitoreo complementan el flujo. El caso también exige reportes de uso, historial de cambios, catálogo editable y recuperación tras fallos.

## Tecnologías

| Capa | Elección | Motivo |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Interfaz web para calendario, disponibilidad, solicitudes, estados y administración del catálogo. |
| Navegación y datos | Estado React + `fetch` tipado | Cuatro vistas y actualización después de cambios, con menos dependencias para acelerar esta primera versión. |
| Backend | Python + FastAPI + Pydantic | API HTTP tipada para validaciones, permisos, reservas, reportes y notificaciones. |
| Persistencia | SQLite + `sqlite3` estándar | Menos dependencias y arranque rápido; SQL parametrizado y migraciones `.sql`. `db/schema.sql` define la versión inicial. |
| Pruebas | pytest + verificación de navegador con Playwright | Permisos, concurrencia y recorrido real frontend → API → SQLite en una base temporal. |
| Operación | Logs estructurados + endpoint `/health` + copias con la API de backup de SQLite | Medir errores, latencia y disponibilidad; ensayar restauración. |

Desplegar frontend estático y **un único servicio backend con acceso al archivo SQLite en disco local persistente**. No compartir el archivo por una unidad de red entre varias instancias. Si la carga real exige muchos escritores o múltiples servidores, evaluar PostgreSQL; el objetivo de 200 usuarios concurrentes y p95 ≤ 2 s del DOCX requiere una prueba de carga, no queda garantizado por elegir SQLite.

## Responsabilidades y flujo

1. La interfaz consulta laboratorios, filtros por fecha/franja y solicitudes; nunca decide permisos ni confirma reservas por sí sola.
2. La API autoriza **cada operación** según rol y propiedad. De momento se usa `X-Demo-User` exclusivamente en `DEMO_MODE=1` y desde localhost; antes de desplegar fuera de pruebas se debe integrar autenticación institucional. Docente: solicitudes propias; delegado: solicitudes para un curso y docente autorizado en `autorizaciones_curso`; administrador: aprobación/rechazo, bloqueos y catálogo; coordinador: supervisión, reportes y cambios autorizados. Las asignaciones institucionales reales se deben acordar con la UNS antes de habilitar el servicio productivo.
3. El servicio valida horario, capacidad, estado de laboratorio y actores; crea solicitudes `pendiente`. Al aprobar o reprogramar, una transacción `BEGIN IMMEDIATE` y los triggers SQLite impiden que dos reservas `confirmada` se crucen para un mismo laboratorio y fecha. Intervalos semiabiertos `[inicio, fin)`: 10:00–11:00 y 11:00–12:00 no se solapan. La consulta previa de disponibilidad es informativa: la confirmación vuelve a validar en la base. Un conflicto devuelve HTTP 409 y permite elegir otro horario.
4. Los bloqueos administrativos también impiden confirmar reservas en la misma franja; el servidor comprueba que no haya reservas confirmadas antes de añadir un bloqueo. Cambios de estado, actor y motivo se registran en `historial_reservas` en la misma transacción.
5. El backend registra el aviso en `notificaciones` **en la misma transacción** que modifica la reserva y lo expone a la web; un envío de correo futuro debe procesarse con reintentos desde esa tabla para que una caída del correo no revierta la reserva.

## Datos iniciales y endpoints previstos

Tablas: `usuarios`, `laboratorios`, `cursos`, `reservas`, `bloqueos`, `historial_reservas`, `notificaciones`, `incidencias`, `autorizaciones_curso` y `eventos_seguridad`. `reservas` guarda fecha ISO, horas `HH:MM`, responsable, solicitante, curso, participantes y estado. Horarios regulares y equipamiento detallado del laboratorio pueden ampliarse en una migración al acordar su estructura con la UNS.

API disponible: `GET /agenda?desde=&hasta=` muestra reservas confirmadas sin datos personales y bloqueos para la vista semanal; `GET /autorizaciones-curso` proporciona las opciones del delegado. Se mantienen disponibilidad, reservas, aprobaciones, cancelaciones, catálogo, reportes, notificaciones y estado del sistema. En desarrollo, Vite redirige `/api` al backend; `backend.web` sirve frontend compilado y API en el mismo puerto. La identidad demo sale de `X-Demo-User` verificado contra el catálogo de usuarios; nunca de un `usuario_id` de la solicitud. Consultar `README.md` para probarla.

## SQLite y comprobaciones

- Activar `PRAGMA foreign_keys = ON` y `PRAGMA busy_timeout = 5000` **en cada conexión**; la base inicial usa `journal_mode = WAL`. Usar transacciones cortas y evitar consultas largas mientras se escriben reservas.
- `db/schema.sql` incluye índices de consulta y triggers de no superposición en inserción y actualización, para reservas confirmadas y bloqueos; `db/migrations/002_autorizaciones.sql` añade la autorización del delegado y el registro de operaciones denegadas. Las solicitudes pendientes pueden coincidir; solo una de ellas podrá ser confirmada en un intervalo cruzado.
- En pruebas: ejecutar 100 pares de confirmaciones simultáneas para el mismo laboratorio y franja (cero parejas confirmadas superpuestas); intentar modificaciones ajenas con cada rol (rechazo y registro); medir p95 ≤ 2 s con 200 usuarios; registrar cinco laboratorios por la interfaz administrativa sin editar el código.
- Hacer backups consistentes con la API de backup de SQLite (no copiar solo el `.sqlite3` mientras WAL esté activo), conservar copias fuera del servidor y probar restauración en ≤ 10 minutos sin perder reservas confirmadas. La frecuencia de backup debe acordarse con la tolerancia de pérdida de datos; si esta es cero, solo las copias periódicas no bastan.

## Observaciones del diagrama

El diagrama separa correctamente actores, presentación, servicios y persistencia, y señala permisos del lado servidor y protección contra superposición en la base. Al convertirlo en código, notificaciones y monitoreo deben tratarse como responsabilidades del backend; la flecha de monitoreo representa observación de los servicios, no un flujo de negocio que autorice o escriba reservas.
