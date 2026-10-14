USE DBCIPBeneficios;
GO

CREATE TABLE usuarios (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(200) NOT NULL,
    rol             VARCHAR(30) NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')),
    activo          BIT DEFAULT 1,
    ultimo_acceso   DATETIME2,
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
GO

CREATE TABLE refresh_tokens (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id     UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  DATETIME2 NOT NULL,
    created_at  DATETIME2 DEFAULT GETDATE(),
    revoked     BIT DEFAULT 0
);
GO

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
GO

CREATE TABLE beneficios (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    nombre          VARCHAR(200) NOT NULL,
    descripcion     NVARCHAR(MAX),
    tipo            VARCHAR(50) NOT NULL CHECK (tipo IN ('ASISTENCIA_ECONOMICA', 'CAPACITACION', 'SEGURO', 'BONO', 'OTRO')),
    monto_base      DECIMAL(12,2) NOT NULL DEFAULT 0,
    moneda          VARCHAR(3) DEFAULT 'PEN',
    activo          BIT DEFAULT 1,
    requiere_junta  BIT DEFAULT 0,
    created_by      UNIQUEIDENTIFIER FOREIGN KEY REFERENCES usuarios(id),
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_beneficios_tipo ON beneficios(tipo);
CREATE INDEX idx_beneficios_activo ON beneficios(activo);
GO

CREATE TABLE solicitudes_beneficio (
    id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    colegiado_id        VARCHAR(50) NOT NULL,
    beneficio_id        UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES beneficios(id),
    monto_solicitado    DECIMAL(12,2) NOT NULL,
    motivo              NVARCHAR(MAX) NOT NULL,
    estado              VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'PAGADA')),
    fecha_solicitud     DATETIME2 DEFAULT GETDATE(),
    fecha_resolucion    DATETIME2,
    resuelto_por        UNIQUEIDENTIFIER FOREIGN KEY REFERENCES usuarios(id),
    observaciones       NVARCHAR(MAX),
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_solicitudes_colegiado ON solicitudes_beneficio(colegiado_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes_beneficio(estado);
CREATE INDEX idx_solicitudes_fecha ON solicitudes_beneficio(fecha_solicitud);
GO

CREATE TABLE pagos (
    id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    solicitud_id        UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES solicitudes_beneficio(id),
    colegiado_id        VARCHAR(50) NOT NULL,
    monto_pagado        DECIMAL(12,2) NOT NULL,
    moneda              VARCHAR(3) DEFAULT 'PEN',
    medio_pago          VARCHAR(30) NOT NULL CHECK (medio_pago IN ('TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO')),
    referencia_pago     VARCHAR(100),
    fecha_pago          DATETIME2 NOT NULL DEFAULT GETDATE(),
    estado              VARCHAR(30) NOT NULL DEFAULT 'COMPLETADO'
                        CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'REVERTIDO', 'ANULADO')),
    registrado_por      UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES usuarios(id),
    comprobante_url     VARCHAR(500),
    notas               NVARCHAR(MAX),
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_pagos_solicitud ON pagos(solicitud_id);
CREATE INDEX idx_pagos_colegiado ON pagos(colegiado_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX idx_pagos_estado ON pagos(estado);
GO

CREATE TABLE audit_logs (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id     UNIQUEIDENTIFIER NOT NULL,
    action      VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    entity      VARCHAR(50) NOT NULL,
    entity_id   VARCHAR(100) NOT NULL,
    changes_json NVARCHAR(MAX),
    ip_address  VARCHAR(45),
    user_agent  NVARCHAR(MAX),
    created_at  DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
GO

CREATE TRIGGER trg_usuarios_updated_at ON usuarios
    AFTER UPDATE AS BEGIN
        UPDATE usuarios SET updated_at = GETDATE()
        FROM inserted i WHERE usuarios.id = i.id;
    END;
GO

CREATE TRIGGER trg_beneficios_updated_at ON beneficios
    AFTER UPDATE AS BEGIN
        UPDATE beneficios SET updated_at = GETDATE()
        FROM inserted i WHERE beneficios.id = i.id;
    END;
GO

CREATE TRIGGER trg_solicitudes_updated_at ON solicitudes_beneficio
    AFTER UPDATE AS BEGIN
        UPDATE solicitudes_beneficio SET updated_at = GETDATE()
        FROM inserted i WHERE solicitudes_beneficio.id = i.id;
    END;
GO

CREATE TRIGGER trg_pagos_updated_at ON pagos
    AFTER UPDATE AS BEGIN
        UPDATE pagos SET updated_at = GETDATE()
        FROM inserted i WHERE pagos.id = i.id;
    END;
GO

DECLARE @admin_id UNIQUEIDENTIFIER = NEWID();
DECLARE @oper_id UNIQUEIDENTIFIER = NEWID();
DECLARE @aud_id UNIQUEIDENTIFIER = NEWID();

INSERT INTO usuarios (id, username, email, password_hash, nombre_completo, rol) VALUES
(@admin_id, 'admin', 'admin@sistemacip.pe', '$2b$10$YQ8GvFOJZmKMkBfVz/JXMeJvDP5G9Vz5q4X5q5X5q5X5q5X5q5X5q', 'Administrador del Sistema', 'ADMINISTRADOR'),
(@oper_id, 'operador1', 'operador@sistemacip.pe', '$2b$10$YQ8GvFOJZmKMkBfVz/JXMeJvDP5G9Vz5q4X5q5X5q5X5q5X5q5X5q', 'Operador de Pagos', 'OPERADOR_PAGOS'),
(@aud_id, 'auditor1', 'auditor@sistemacip.pe', '$2b$10$YQ8GvFOJZmKMkBfVz/JXMeJvDP5G9Vz5q4X5q5X5q5X5q5X5q5X5q', 'Auditor del Sistema', 'AUDITOR');
GO

PRINT '=== Tablas y datos iniciales creados en DBCIPBeneficios ===';
GO
