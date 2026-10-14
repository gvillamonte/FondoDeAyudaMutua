-- ============================================================
-- 013: Comprobantes contables para reembolso + descuento COVID
-- en expedientes de beneficio
-- ============================================================

-- Tabla de comprobantes contables (PDFs verificables para reembolso)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('fam_reembolso_comprobantes') AND type = 'U')
BEGIN
    CREATE TABLE fam_reembolso_comprobantes (
        id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        covid_asignacion_id    UNIQUEIDENTIFIER NOT NULL,
        tipo_comprobante       NVARCHAR(30)     NOT NULL,
        serie                  NVARCHAR(10)     NULL,
        numero                 NVARCHAR(20)     NULL,
        concepto               NVARCHAR(255)    NULL,
        importe_total          DECIMAL(12, 2)   NOT NULL,
        pdf_base64             NVARCHAR(MAX)    NULL,
        created_at             DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_fam_reembolso_comprobantes PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_fam_reembolso_comp_asignacion FOREIGN KEY (covid_asignacion_id)
            REFERENCES fam_covid_asignaciones(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_fam_reembolso_comp_asignacion ON fam_reembolso_comprobantes(covid_asignacion_id);
END
GO

-- Columnas nuevas en expedientes para integrar descuento COVID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'covid_asignacion_id')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD covid_asignacion_id UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'descuento_covid')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD descuento_covid DECIMAL(12, 2) NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'monto_final')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD monto_final DECIMAL(12, 2) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'modalidad_beneficio')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD modalidad_beneficio NVARCHAR(30) NULL;
END
GO
