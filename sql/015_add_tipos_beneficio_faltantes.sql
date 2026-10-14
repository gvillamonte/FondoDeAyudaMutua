-- ============================================================
-- 015: Agregar tipos de beneficio faltantes al catálogo
-- ============================================================

-- Fallecimiento (verificar si existe)
IF NOT EXISTS (SELECT 1 FROM tipos_beneficio_config WHERE nombre = 'Fallecimiento')
BEGIN
    INSERT INTO tipos_beneficio_config (nombre, descripcion, activo)
    VALUES ('Fallecimiento', 'Beneficio por fallecimiento del colegiado titular', 1);
    PRINT 'Tipo Fallecimiento insertado';
END
ELSE
    PRINT 'Tipo Fallecimiento ya existe';
GO

-- Accidente Grave
IF NOT EXISTS (SELECT 1 FROM tipos_beneficio_config WHERE nombre = 'Accidente Grave')
BEGIN
    INSERT INTO tipos_beneficio_config (nombre, descripcion, activo)
    VALUES ('Accidente Grave', 'Beneficio por accidente grave que impide laborar', 1);
    PRINT 'Tipo Accidente Grave insertado';
END
ELSE
    PRINT 'Tipo Accidente Grave ya existe';
GO

-- Enfermedad Terminal
IF NOT EXISTS (SELECT 1 FROM tipos_beneficio_config WHERE nombre = 'Enfermedad Terminal')
BEGIN
    INSERT INTO tipos_beneficio_config (nombre, descripcion, activo)
    VALUES ('Enfermedad Terminal', 'Beneficio por enfermedad terminal o invalidez permanente', 1);
    PRINT 'Tipo Enfermedad Terminal insertado';
END
ELSE
    PRINT 'Tipo Enfermedad Terminal ya existe';
GO

-- Verificacion
SELECT id, nombre, descripcion, activo FROM tipos_beneficio_config ORDER BY id;
GO
