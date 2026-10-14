-- =============================================================
-- Migracion 016: Logo institucional del CIP para reportes
-- Almacena el logo en base64 dentro de fam_configuracion
-- (clave: LOGO_CIP) para ser usado por el modulo Reportes
-- =============================================================
IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'fam_configuracion'
      AND COLUMN_NAME = 'valor'
      AND CHARACTER_MAXIMUM_LENGTH < 4000
)
BEGIN
    ALTER TABLE fam_configuracion ALTER COLUMN valor NVARCHAR(MAX);
    PRINT 'Columna fam_configuracion.valor ampliada a NVARCHAR(MAX)';
END
ELSE
    PRINT 'Columna fam_configuracion.valor ya es NVARCHAR(MAX) o no existe';
GO

IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'LOGO_CIP')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, descripcion, activo, grupo)
    VALUES (
        CONVERT(NVARCHAR(36), NEWID()),
        'LOGO_CIP',
        '',
        'Logo institucional del CIP para reportes (base64)',
        1,
        'GENERAL'
    );
    PRINT 'Clave LOGO_CIP creada';
END
ELSE
    PRINT 'Clave LOGO_CIP ya existe';
GO
