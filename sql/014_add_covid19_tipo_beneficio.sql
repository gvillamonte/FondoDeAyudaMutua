-- ============================================================
-- 014: Agregar tipo operacional COVID-19 a tipos_beneficio
-- ============================================================
-- COVID-19 es un tipo de beneficio que se descuenta del
-- monto de Enfermedad Terminal. Otros beneficios no se afectan.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM tipos_beneficio WHERE codigo = 'COVID_19' AND programa = 'FAM')
BEGIN
    INSERT INTO tipos_beneficio (id, codigo, nombre, descripcion, programa, activo, created_at)
    VALUES ('TB-FAM-004', 'COVID_19', 'COVID-19', 'Descuento por ayuda COVID-19 sobre Enfermedad Terminal', 'FAM', 1, GETDATE());

    PRINT 'Tipo operacional COVID-19 (FAM) insertado';
END
ELSE
    PRINT 'Tipo operacional COVID-19 (FAM) ya existe';
GO

-- Verificacion
SELECT id, codigo, nombre, programa, activo FROM tipos_beneficio WHERE codigo = 'COVID_19';
GO
