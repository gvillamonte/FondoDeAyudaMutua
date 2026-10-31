-- ============================================================
-- 020: Acta de Defuncion del expediente FAM (Fallecimiento)
-- Documento PDF escaneado del acta de defuncion del colegiado.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficio') AND name = 'acta_defuncion')
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD acta_defuncion NVARCHAR(MAX) NULL;
    PRINT 'Columna acta_defuncion creada';
END
ELSE
    PRINT 'Columna acta_defuncion ya existe';
GO
