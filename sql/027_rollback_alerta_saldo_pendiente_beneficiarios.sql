-- ==============================================================================
-- Rollback: 027_rollback_alerta_saldo_pendiente_beneficiarios.sql
-- Propósito: Revertir de forma segura los cambios de la migración 027.
-- ==============================================================================

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fam_solicitud_tiene_saldo' AND object_id = OBJECT_ID('fam_solicitud_beneficio'))
BEGIN
    DROP INDEX IX_fam_solicitud_tiene_saldo ON fam_solicitud_beneficio;
    PRINT 'Indice IX_fam_solicitud_tiene_saldo eliminado.';
END
GO

IF OBJECT_ID('expediente_beneficiario_audit', 'U') IS NOT NULL
BEGIN
    DROP TABLE expediente_beneficiario_audit;
    PRINT 'Tabla expediente_beneficiario_audit eliminada.';
END
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'tiene_saldo_pendiente')
BEGIN
    ALTER TABLE fam_solicitud_beneficio DROP COLUMN tiene_saldo_pendiente;
    PRINT 'Columna tiene_saldo_pendiente eliminada.';
END
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'saldo_pendiente')
BEGIN
    ALTER TABLE fam_solicitud_beneficio DROP COLUMN saldo_pendiente;
    PRINT 'Columna saldo_pendiente eliminada.';
END
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'monto_total_asignado')
BEGIN
    ALTER TABLE fam_solicitud_beneficio DROP COLUMN monto_total_asignado;
    PRINT 'Columna monto_total_asignado eliminada.';
END
GO

DELETE FROM fam_configuracion WHERE clave IN ('montoMinimoFallecimiento', 'ALERTA_SALDO_PENDIENTE_ENABLED');
PRINT 'Registros de configuracion eliminados.';
GO

