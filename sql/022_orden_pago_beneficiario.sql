-- ============================================================
-- 022: Orden de Pago por beneficiario
-- Cada beneficiario vinculado a un expediente FAM puede tener
-- su propia orden de pago en PDF.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fam_solicitud_beneficiarios') AND name = 'orden_pago')
BEGIN
    ALTER TABLE fam_solicitud_beneficiarios ADD orden_pago NVARCHAR(MAX) NULL;
    PRINT 'Columna orden_pago creada';
END
ELSE
    PRINT 'Columna orden_pago ya existe';
GO
