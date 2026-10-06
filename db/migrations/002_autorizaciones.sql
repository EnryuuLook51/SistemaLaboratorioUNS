-- Extensión del esquema original para representar delegación y auditoría de accesos.
CREATE TABLE IF NOT EXISTS autorizaciones_curso (
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    delegado_id INTEGER NOT NULL REFERENCES usuarios(id),
    docente_id INTEGER NOT NULL REFERENCES usuarios(id),
    PRIMARY KEY (curso_id, delegado_id, docente_id)
);

CREATE TABLE IF NOT EXISTS eventos_seguridad (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    accion TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
