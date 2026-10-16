# Dirección visual elegida

**Referencia principal: [1.png](referencias/1.png).** La prioridad es su **horario semanal**: días en columnas, horas en filas y reservas colocadas en el momento que ocupan. Permite entender rápidamente cuándo hay clases y ofrece una vía directa para solicitar un espacio. Usaremos también su estilo claro, tipografía sobria, azul universitario y formulario junto a la agenda como base del frontend.

## Comparación

| Referencia | Lo mejor | Decisión |
| --- | --- | --- |
| **`1.png` — elegida** | Horario semanal concreto y legible, filtros encima, solicitud al lado de la agenda. | Base visual y estructura de la pantalla de reservas. |
| `2.png` | Excelente mapa de calor para percibir demanda y ocupación general. | Reservarlo para reportes: sus porcentajes no muestran qué laboratorio y franja están libres. |
| `3.png` | Tono cálido y universitario. | Buena inspiración editorial, pero dedica demasiado espacio a la bienvenida para una tarea centrada en horarios. |
| `4.png` | Calendario similar al de la 1, acompañado de aprobaciones y métricas. | Inspiración para la vista administrativa; tiene más información simultánea de la que necesita un docente al reservar. |

## Cómo llevarla a la aplicación

1. Poner el **horario semanal de `1.png` como protagonista**: lunes a viernes en columnas y horas en filas. Cada bloque de reserva debe incluir laboratorio, actividad, hora y estado, con etiquetas textuales además de color. Navegación de semanas y botón «Hoy».
2. Situar filtros de fecha, capacidad, laboratorio/equipamiento encima de la agenda. Al elegir una franja libre, completar fecha y horario en el formulario lateral; al seleccionar una reserva, mostrar su detalle sin perder el contexto semanal.
3. Mantener a la derecha el formulario «Nueva solicitud» y, debajo, información breve sobre solicitudes propias. La consulta visual es orientativa: el backend vuelve a verificar disponibilidad y puede responder 409 si alguien confirmó esa franja antes.
4. Para administración, conservar el mismo lenguaje visual y horario, pero sustituir o complementar el formulario lateral con «Por aprobar», bloqueos y acciones. La idea de `4.png` sirve para esa variante por rol.
5. En móvil, elegir un día a la vez y mostrar su columna horaria a ancho completo; debajo, el formulario o un botón que lo abra. Evitar comprimir las cinco columnas hasta que los bloques sean ilegibles.

**Guía visual inicial:** fondo `#f4f7fb`, superficies `#ffffff`, bordes `#dce5ee`, texto principal `#223650`, secundario `#73849a` y azul de acción `#315f96`. Reservas diferenciadas con fondos azul, verde y violeta suaves; ámbar para pendientes. Son puntos de partida para implementar, no valores definitivos extraídos de la imagen.
