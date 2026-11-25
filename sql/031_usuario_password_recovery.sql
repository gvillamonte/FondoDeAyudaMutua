-- ==============================================================================
-- MIGRACIÓN 031: Campos para Cambio Obligatorio y Recuperación de Contraseña
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'debe_cambiar_password')
BEGIN
    ALTER TABLE usuarios ADD debe_cambiar_password BIT NOT NULL CONSTRAINT DF_usuarios_debe_cambiar_pass DEFAULT 0;
    PRINT 'Columna debe_cambiar_password agregada en usuarios.';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'reset_password_token')
BEGIN
    ALTER TABLE usuarios ADD reset_password_token VARCHAR(255) NULL;
    PRINT 'Columna reset_password_token agregada en usuarios.';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'reset_password_expires')
BEGIN
    ALTER TABLE usuarios ADD reset_password_expires DATETIME2 NULL;
    PRINT 'Columna reset_password_expires agregada en usuarios.';
END
