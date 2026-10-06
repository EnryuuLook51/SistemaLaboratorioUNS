# Prototipos HTML · Reserva de Laboratorios UNS

Abre [`index.html`](index.html) en el navegador para comparar las tres propuestas. El selector mantiene cada versión en su propio archivo HTML; también puedes abrir cada una de forma independiente. Si prefieres un servidor local, desde `app/` ejecuta `python -m http.server 8080` y visita `http://127.0.0.1:8080/prototypes/`.

| Versión | Enfoque | Interacciones para probar |
| --- | --- | --- |
| [01 · Panel académico](01-panel-academico.html) | Resumen para docentes, disponibilidad, próximas clases y solicitudes. | Cambiar día, elegir laboratorio, enviar formulario y ver solicitud pendiente. |
| [02 · Agenda operativa](02-agenda-operativa.html) | Vista densa para administración y aprobación de reservas. | Navegar días, inspeccionar un bloque, aprobar/rechazar y comprobar un conflicto de horario. |
| [03 · Catálogo visual](03-catalogo-laboratorios.html) | Explorar laboratorios con una presentación más cálida y orientada a móvil. | Buscar, filtrar, marcar favoritos y abrir el panel de solicitud. |

Los datos e interacciones son **simulados en el navegador** para comparar diseño y flujos sin afectar la base SQLite. Los laboratorios A1, B2 y C3 coinciden con el seed del backend; los demás ilustran cómo crecería el catálogo. Cuando se elija un enfoque, el frontend podrá conectarse a la API descrita en `../README.md`.

Tras revisar las [referencias visuales](../docs/referencias/), la [dirección visual seleccionada](../docs/direccion-visual.md) es `1.png`, con su horario semanal por día y hora como pieza central.
