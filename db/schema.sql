-- Esquema inicial SQLite. Aplicar sobre una base vacía; migraciones posteriores en db/migrations/.
PRAGMA foreign_keys = ON;

CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    codigo_institucional TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL CHECK (rol IN ('docente', 'delegado', 'administrador', 'coordinador')),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE laboratorios (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    capacidad INTEGER NOT NULL CHECK (capacidad > 0),
    equipos TEXT NOT NULL DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE cursos (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL
);

CREATE TABLE reservas (
    id INTEGER PRIMARY KEY,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
    responsable_id INTEGER NOT NULL REFERENCES usuarios(id),
    fecha TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    inicio TEXT NOT NULL CHECK (inicio GLOB '[0-2][0-9]:[0-5][0-9]' AND inicio < '24:00'),
    fin TEXT NOT NULL CHECK (fin GLOB '[0-2][0-9]:[0-5][0-9]' AND fin <= '24:00'),
    participantes INTEGER NOT NULL CHECK (participantes > 0),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'cancelada')),
    creada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (inicio < fin)
);

CREATE TABLE bloqueos (
    id INTEGER PRIMARY KEY,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
    fecha TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    inicio TEXT NOT NULL CHECK (inicio GLOB '[0-2][0-9]:[0-5][0-9]' AND inicio < '24:00'),
    fin TEXT NOT NULL CHECK (fin GLOB '[0-2][0-9]:[0-5][0-9]' AND fin <= '24:00'),
    motivo TEXT NOT NULL,
    creado_por_id INTEGER NOT NULL REFERENCES usuarios(id),
    CHECK (inicio < fin)
);

CREATE TABLE historial_reservas (
    id INTEGER PRIMARY KEY,
    reserva_id INTEGER NOT NULL REFERENCES reservas(id),
    actor_id INTEGER NOT NULL REFERENCES usuarios(id),
    accion TEXT NOT NULL,
    detalle TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notificaciones (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    reserva_id INTEGER REFERENCES reservas(id),
    mensaje TEXT NOT NULL,
    leida_en TEXT,
    creada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidencias (
    id INTEGER PRIMARY KEY,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
    reserva_id INTEGER REFERENCES reservas(id),
    reportada_por_id INTEGER NOT NULL REFERENCES usuarios(id),
    descripcion TEXT NOT NULL,
    creada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reservas_disponibilidad ON reservas(laboratorio_id, fecha, inicio, fin) WHERE estado = 'confirmada';
CREATE INDEX idx_reservas_solicitante ON reservas(solicitante_id, fecha);
CREATE INDEX idx_bloqueos_disponibilidad ON bloqueos(laboratorio_id, fecha, inicio, fin);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, creada_en);

-- Un índice UNIQUE sobre (fecha, inicio, fin) no detectaría intervalos parcialmente cruzados.
CREATE TRIGGER reservas_sin_cruces_insert BEFORE INSERT ON reservas
WHEN NEW.estado = 'confirmada'
BEGIN
    SELECT RAISE(ABORT, 'horario no disponible') WHERE EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.laboratorio_id = NEW.laboratorio_id AND r.fecha = NEW.fecha
          AND r.estado = 'confirmada' AND NEW.inicio < r.fin AND r.inicio < NEW.fin
    ) OR EXISTS (
        SELECT 1 FROM bloqueos b
        WHERE b.laboratorio_id = NEW.laboratorio_id AND b.fecha = NEW.fecha
          AND NEW.inicio < b.fin AND b.inicio < NEW.fin
    );
END;

CREATE TRIGGER reservas_sin_cruces_update BEFORE UPDATE OF laboratorio_id, fecha, inicio, fin, estado ON reservas
WHEN NEW.estado = 'confirmada'
BEGIN
    SELECT RAISE(ABORT, 'horario no disponible') WHERE EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.id <> OLD.id AND r.laboratorio_id = NEW.laboratorio_id AND r.fecha = NEW.fecha
          AND r.estado = 'confirmada' AND NEW.inicio < r.fin AND r.inicio < NEW.fin
    ) OR EXISTS (
        SELECT 1 FROM bloqueos b
        WHERE b.laboratorio_id = NEW.laboratorio_id AND b.fecha = NEW.fecha
          AND NEW.inicio < b.fin AND b.inicio < NEW.fin
    );
END;

CREATE TRIGGER bloqueos_sin_cruces_insert BEFORE INSERT ON bloqueos
BEGIN
    SELECT RAISE(ABORT, 'horario no disponible') WHERE EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.laboratorio_id = NEW.laboratorio_id AND r.fecha = NEW.fecha
          AND r.estado = 'confirmada' AND NEW.inicio < r.fin AND r.inicio < NEW.fin
    ) OR EXISTS (
        SELECT 1 FROM bloqueos b
        WHERE b.laboratorio_id = NEW.laboratorio_id AND b.fecha = NEW.fecha
          AND NEW.inicio < b.fin AND b.inicio < NEW.fin
    );
END;

CREATE TRIGGER bloqueos_sin_cruces_update BEFORE UPDATE OF laboratorio_id, fecha, inicio, fin ON bloqueos
BEGIN
    SELECT RAISE(ABORT, 'horario no disponible') WHERE EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.laboratorio_id = NEW.laboratorio_id AND r.fecha = NEW.fecha
          AND r.estado = 'confirmada' AND NEW.inicio < r.fin AND r.inicio < NEW.fin
    ) OR EXISTS (
        SELECT 1 FROM bloqueos b
        WHERE b.id <> OLD.id AND b.laboratorio_id = NEW.laboratorio_id AND b.fecha = NEW.fecha
          AND NEW.inicio < b.fin AND b.inicio < NEW.fin
    );
END;
