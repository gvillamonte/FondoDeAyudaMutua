-- ============================================================
-- 033_remover_dashboard_operador_fam.sql
-- Restricción de acceso: El rol OPERADOR_FAM no debe acceder al Dashboard general
-- ============================================================

USE DBCIPBeneficios;
GO

IF EXISTS (SELECT 1 FROM roles WHERE id = 'OPERADOR_FAM')
BEGIN
    UPDATE roles
    SET modulos = '["fam","beneficios","colegiados","reportes"]'
    WHERE id = 'OPERADOR_FAM';
    PRINT 'Rol OPERADOR_FAM actualizado: dashboard removido de sus módulos.';
END
GO
