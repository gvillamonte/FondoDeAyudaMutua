-- =============================================================
-- Migracion 018: Datos especiales del expediente FAM
-- Fallecimiento / Enfermedad Terminal / Accidente Grave
-- =============================================================

IF COL_LENGTH('fam_solicitud_beneficio', 'fecha_defuncion') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD fecha_defuncion DATETIME2 NULL;
    PRINT 'Columna fecha_defuncion creada';
END
ELSE
    PRINT 'Columna fecha_defuncion ya existe';
GO

IF COL_LENGTH('fam_solicitud_beneficio', 'causa_fallecimiento') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD causa_fallecimiento NVARCHAR(300) NULL;
    PRINT 'Columna causa_fallecimiento creada';
END
ELSE
    PRINT 'Columna causa_fallecimiento ya existe';
GO

IF COL_LENGTH('fam_solicitud_beneficio', 'fecha_diagnostico') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD fecha_diagnostico DATETIME2 NULL;
    PRINT 'Columna fecha_diagnostico creada';
END
ELSE
    PRINT 'Columna fecha_diagnostico ya existe';
GO

IF COL_LENGTH('fam_solicitud_beneficio', 'diagnostico_medico') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD diagnostico_medico NVARCHAR(500) NULL;
    PRINT 'Columna diagnostico_medico creada';
END
ELSE
    PRINT 'Columna diagnostico_medico ya existe';
GO

IF COL_LENGTH('fam_solicitud_beneficio', 'fecha_accidente') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD fecha_accidente DATETIME2 NULL;
    PRINT 'Columna fecha_accidente creada';
END
ELSE
    PRINT 'Columna fecha_accidente ya existe';
GO

IF COL_LENGTH('fam_solicitud_beneficio', 'descripcion_accidente') IS NULL
BEGIN
    ALTER TABLE fam_solicitud_beneficio ADD descripcion_accidente NVARCHAR(500) NULL;
    PRINT 'Columna descripcion_accidente creada';
END
ELSE
    PRINT 'Columna descripcion_accidente ya existe';
GO
