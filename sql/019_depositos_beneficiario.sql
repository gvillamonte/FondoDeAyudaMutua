-- ============================================================
-- 019: Declaracion jurada por beneficiario y depositos por beneficiario
-- Un expediente FAM puede tener varios beneficiarios; cada uno con su
-- propia declaracion jurada y su propio deposito (misma fecha de pago).
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficiarios') AND name = 'declaracion_jurada')
BEGIN
    ALTER TABLE fam_solicitud_beneficiarios ADD declaracion_jurada NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficiarios') AND name = 'declaracion_jurada_dni')
BEGIN
    ALTER TABLE fam_solicitud_beneficiarios ADD declaracion_jurada_dni VARCHAR(20) NULL;
END
GO

IF OBJECT_ID('fam_depositos_beneficiario', 'U') IS NULL
BEGIN
    CREATE TABLE fam_depositos_beneficiario (
        id NVARCHAR(36) NOT NULL PRIMARY KEY,
        solicitud_id NVARCHAR(36) NOT NULL
            REFERENCES fam_solicitud_beneficio(id) ON DELETE CASCADE,
        beneficiario_id NVARCHAR(36) NULL
            REFERENCES fam_beneficiarios(id),
        nombre_beneficiario NVARCHAR(200) NULL,
        dni_beneficiario VARCHAR(20) NULL,
        porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
        monto DECIMAL(12,2) NOT NULL,
        banco VARCHAR(100) NULL,
        numero_cuenta VARCHAR(50) NULL,
        cci VARCHAR(30) NULL,
        fecha_pago DATETIME2 NULL,
        comprobante_pdf NVARCHAR(MAX) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'PAGADO',
        registrado_por NVARCHAR(36) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_fam_deposito_beneficiario UNIQUE (solicitud_id, beneficiario_id)
    );

    CREATE INDEX IX_fam_depositos_solicitud ON fam_depositos_beneficiario(solicitud_id);
    PRINT 'Tabla fam_depositos_beneficiario creada';
END
ELSE
    PRINT 'Tabla fam_depositos_beneficiario ya existe';
GO
