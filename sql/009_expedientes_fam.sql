-- ============================================================
-- 009: Expedientes de Beneficio FAM - campos de documentacion y entrega
-- Agrega: fecha_pago, documentacion_completa, documentacion_observacion
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'fecha_pago')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD fecha_pago DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'documentacion_completa')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD documentacion_completa BIT NOT NULL CONSTRAINT DF_fam_solicitud_doccompleta DEFAULT (1);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'documentacion_observacion')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD documentacion_observacion NVARCHAR(1000) NULL;
END
GO
