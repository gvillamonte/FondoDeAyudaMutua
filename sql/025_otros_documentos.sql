-- ============================================================
-- 025: Otros / Documentacion Completa para Expedientes FAM
-- Permite adjuntar el expediente escaneado completo o documentos adicionales en PDF.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'otros_documentos')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD otros_documentos NVARCHAR(MAX) NULL;
    PRINT 'Columna otros_documentos creada en fam_solicitud_beneficio';
END
ELSE
    PRINT 'Columna otros_documentos ya existe en fam_solicitud_beneficio';
GO
