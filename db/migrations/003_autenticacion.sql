ALTER TABLE usuarios ADD COLUMN password_hash TEXT;

CREATE TABLE sesiones (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_en INTEGER NOT NULL
);
CREATE INDEX idx_sesiones_expiracion ON sesiones(expira_en);

CREATE TABLE intentos_login (
    clave TEXT PRIMARY KEY,
    fallos INTEGER NOT NULL DEFAULT 0,
    expira_en INTEGER NOT NULL
);
