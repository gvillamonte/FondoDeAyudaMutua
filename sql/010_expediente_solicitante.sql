-- ============================================================
-- 010: Expedientes FAM - solicitante y sucesion intestada
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'solicitante_beneficiario_id')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD solicitante_beneficiario_id NVARCHAR(36) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'solicitante_nombre')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD solicitante_nombre NVARCHAR(200) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'solicitante_dni')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD solicitante_dni VARCHAR(20) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'sucesion_intestada')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD sucesion_intestada NVARCHAR(MAX) NULL;
END
GO
