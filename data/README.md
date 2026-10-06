# Base local

Al iniciar la aplicación, se crea `reservas.sqlite3` con el esquema y los datos de demostración. Git conserva el SQL, las migraciones y el seed; cada equipo genera su propia base local para hacer pruebas.

Para empezar otra ronda sin perder una base anterior, detén el servidor y establece `RESERVAS_DB` con una ruta nueva antes de ejecutar el script de inicio. Consulta `../docs/guia-companero.md`.
