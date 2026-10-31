-- ========================================================================
-- 026: Sucesión Intestada con Múltiples Beneficiarios y Versionamiento
-- ========================================================================

-- 1. Tabla principal de Sucesión Intestada ligada a la Solicitud/Expediente
IF OBJECT_ID('fam_sucesiones_intestadas', 'U') IS NULL
BEGIN
    CREATE TABLE fam_sucesiones_intestadas (
        id NVARCHAR(36) NOT NULL PRIMARY KEY,
        solicitud_id NVARCHAR(36) NOT NULL UNIQUE
            REFERENCES fam_solicitud_beneficio(id) ON DELETE CASCADE,
        colegiado_id VARCHAR(50) NOT NULL,
        numero_partida_registral VARCHAR(50) NULL,
        notaria_juzgado NVARCHAR(200) NULL,
        fecha_emision_documento DATETIME2 NULL,
        sustento_pdf NVARCHAR(MAX) NOT NULL,
        monto_total DECIMAL(12,2) NOT NULL,
        estado_tramite VARCHAR(30) NOT NULL DEFAULT 'BORRADOR', -- BORRADOR, ENVIADO, OBSERVADO, APROBADO
        version_actual INT NOT NULL DEFAULT 1,
        observaciones NVARCHAR(1000) NULL,
        registrado_por NVARCHAR(36) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_fam_sucesiones_colegiado ON fam_sucesiones_intestadas(colegiado_id);
    CREATE INDEX IX_fam_sucesiones_solicitud ON fam_sucesiones_intestadas(solicitud_id);
    PRINT 'Tabla fam_sucesiones_intestadas creada con éxito.';
END
ELSE
    PRINT 'Tabla fam_sucesiones_intestadas ya existe.';
GO

-- 2. Detalle de Beneficiarios Herederos de la Sucesión
IF OBJECT_ID('fam_sucesion_beneficiarios', 'U') IS NULL
BEGIN
    CREATE TABLE fam_sucesion_beneficiarios (
        id NVARCHAR(36) NOT NULL PRIMARY KEY,
        sucesion_id NVARCHAR(36) NOT NULL
            REFERENCES fam_sucesiones_intestadas(id) ON DELETE CASCADE,
        beneficiario_id NVARCHAR(36) NULL
            REFERENCES fam_beneficiarios(id),
        tipo_documento VARCHAR(10) NOT NULL DEFAULT 'DNI', -- DNI, CE, PASAPORTE
        numero_documento VARCHAR(20) NOT NULL,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        parentesco VARCHAR(50) NOT NULL,
        porcentaje DECIMAL(5,2) NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        telefono VARCHAR(30) NULL,
        email VARCHAR(150) NULL,
        declaracion_jurada_pdf NVARCHAR(MAX) NULL,
        orden_pago_pdf NVARCHAR(MAX) NULL,
        orden INT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_sucesion_documento UNIQUE (sucesion_id, tipo_documento, numero_documento)
    );

    CREATE INDEX IX_sucesion_ben_sucesion ON fam_sucesion_beneficiarios(sucesion_id);
    PRINT 'Tabla fam_sucesion_beneficiarios creada con éxito.';
END
ELSE
    PRINT 'Tabla fam_sucesion_beneficiarios ya existe.';
GO

-- 3. Historial Inmutable de Versiones de Reparto
IF OBJECT_ID('fam_sucesion_versiones', 'U') IS NULL
BEGIN
    CREATE TABLE fam_sucesion_versiones (
        id NVARCHAR(36) NOT NULL PRIMARY KEY,
        sucesion_id NVARCHAR(36) NOT NULL
            REFERENCES fam_sucesiones_intestadas(id) ON DELETE CASCADE,
        numero_version INT NOT NULL,
        snapshot_distribucion_json NVARCHAR(MAX) NOT NULL,
        motivo_modificacion NVARCHAR(500) NOT NULL,
        modificado_por NVARCHAR(36) NULL,
        ip_address VARCHAR(45) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_sucesion_version UNIQUE (sucesion_id, numero_version)
    );

    CREATE INDEX IX_sucesion_versiones_sucesion ON fam_sucesion_versiones(sucesion_id);
    PRINT 'Tabla fam_sucesion_versiones creada con éxito.';
END
ELSE
    PRINT 'Tabla fam_sucesion_versiones ya existe.';
GO
