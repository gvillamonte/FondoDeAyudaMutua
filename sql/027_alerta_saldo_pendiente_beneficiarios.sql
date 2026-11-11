-- ==============================================================================
-- Migración: 027_alerta_saldo_pendiente_beneficiarios.sql
-- Propósito: Configuración de monto mínimo para fallecimiento, columnas de saldo
--            pendiente en expedientes, tabla de auditoría de beneficiarios y backfill.
-- Compatible con: SQL Server (DBCIPBeneficios)
-- ==============================================================================

-- 1. Configuración de Monto Mínimo por Fallecimiento (T1)
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'montoMinimoFallecimiento')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
    VALUES (
        NEWID(),
        'montoMinimoFallecimiento',
        '3000.00',
        'FAM_PARAMETROS',
        'Monto mínimo normativo total requerido para beneficiarios por fallecimiento (S/)',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Configuracion montoMinimoFallecimiento insertada con valor 3000.00';
END
ELSE
BEGIN
    PRINT 'Configuracion montoMinimoFallecimiento ya existe.';
END
GO

-- Feature Flag para alerta de saldo pendiente (T1)
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'ALERTA_SALDO_PENDIENTE_ENABLED')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
    VALUES (
        NEWID(),
        'ALERTA_SALDO_PENDIENTE_ENABLED',
        'true',
        'FEATURE_FLAGS',
        'Activa o desactiva la alerta no bloqueante de saldo pendiente al guardar expedientes',
        1,
        GETDATE(),
        GETDATE()
    );
    PRINT 'Feature flag ALERTA_SALDO_PENDIENTE_ENABLED insertado con valor true';
END
GO

-- 2. Columnas en fam_solicitud_beneficio (T2)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'monto_total_asignado')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD monto_total_asignado DECIMAL(12, 2) NULL;
    PRINT 'Columna monto_total_asignado agregada en fam_solicitud_beneficio.';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'saldo_pendiente')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD saldo_pendiente DECIMAL(12, 2) NULL DEFAULT 0.00;
    PRINT 'Columna saldo_pendiente agregada en fam_solicitud_beneficio.';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'tiene_saldo_pendiente')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD tiene_saldo_pendiente BIT NOT NULL DEFAULT 0;
    PRINT 'Columna tiene_saldo_pendiente agregada en fam_solicitud_beneficio.';
END
GO

-- 3. Tabla de auditoría expediente_beneficiario_audit (T3)
IF OBJECT_ID('expediente_beneficiario_audit', 'U') IS NULL
BEGIN
    CREATE TABLE expediente_beneficiario_audit (
        id NVARCHAR(36) NOT NULL PRIMARY KEY,
        expediente_id NVARCHAR(36) NOT NULL,
        accion VARCHAR(50) NOT NULL, -- 'GUARDADO_CON_SALDO', 'REGULARIZACION', 'AJUSTE', 'ELIMINACION'
        usuario_id NVARCHAR(36) NOT NULL,
        fecha DATETIME2 NOT NULL DEFAULT GETDATE(),
        monto_faltante DECIMAL(12, 2) NOT NULL DEFAULT 0,
        monto_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
        detalle_json NVARCHAR(MAX) NULL,
        ip_address VARCHAR(45) NULL,
        CONSTRAINT FK_exp_ben_audit_expediente FOREIGN KEY (expediente_id) REFERENCES fam_solicitud_beneficio(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_exp_ben_audit_expediente ON expediente_beneficiario_audit(expediente_id);
    CREATE INDEX IX_exp_ben_audit_fecha ON expediente_beneficiario_audit(fecha);
    PRINT 'Tabla expediente_beneficiario_audit creada exitosamente.';
END
GO

-- 4. Backfill para históricos existentes (T4 / R15)
UPDATE fam_solicitud_beneficio
SET
    tiene_saldo_pendiente = 0,
    saldo_pendiente = 0.00,
    monto_total_asignado = ISNULL(monto_final, monto)
WHERE tiene_saldo_pendiente IS NULL OR monto_total_asignado IS NULL;
PRINT 'Backfill de datos historicos completado: tiene_saldo_pendiente=0, saldo_pendiente=0.00.';
GO

-- 5. Índice sobre tiene_saldo_pendiente (T5)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fam_solicitud_tiene_saldo' AND object_id = OBJECT_ID('fam_solicitud_beneficio'))
BEGIN
    CREATE INDEX IX_fam_solicitud_tiene_saldo ON fam_solicitud_beneficio(tiene_saldo_pendiente);
    PRINT 'Indice IX_fam_solicitud_tiene_saldo creado.';
END
GO

