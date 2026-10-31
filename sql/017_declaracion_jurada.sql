-- =============================================================
-- Migracion 017: Declaracion Jurada (PDF + DNI del declarante)
-- Se agrega en la seccion "4. Documentacion" del registro de expedientes
-- =============================================================

IF COL_LENGTH('fam_solicitud_beneficio', 'declaracion_jurada') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD declaracion_jurada NVARCHAR(MAX) NULL;
    PRINT 'Columna declaracion_jurada creada';
END
ELSE
    PRINT 'Columna declaracion_jurada ya existe';
GO

IF COL_LENGTH('fam_solicitud_beneficio', 'declaracion_jurada_dni') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD declaracion_jurada_dni VARCHAR(20) NULL;
    PRINT 'Columna declaracion_jurada_dni creada';
END
ELSE
    PRINT 'Columna declaracion_jurada_dni ya existe';
GO
