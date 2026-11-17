-- ============================================================
-- 028: Numero de Cuenta y CCI para Expedientes FAM
-- Permite registrar el número de cuenta y CCI al que se depositó el beneficio.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'numero_cuenta')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD numero_cuenta VARCHAR(50) NULL;
    PRINT 'Columna numero_cuenta creada en fam_solicitud_beneficio';
END
ELSE
    PRINT 'Columna numero_cuenta ya existe en fam_solicitud_beneficio';
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'cci')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD cci VARCHAR(30) NULL;
    PRINT 'Columna cci creada en fam_solicitud_beneficio';
END
ELSE
    PRINT 'Columna cci ya existe en fam_solicitud_beneficio';
GO
