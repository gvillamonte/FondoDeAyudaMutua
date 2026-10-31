-- Migración 024: Agregar ubigeo (departamento, provincia, distrito), referencia y estado civil a colegiado_actualizaciones
USE DBCIPBeneficios;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'colegiado_actualizaciones' AND COLUMN_NAME = 'departamento_nuevo'
)
BEGIN
    ALTER TABLE colegiado_actualizaciones ADD
        departamento_anterior NVARCHAR(100) NULL,
        departamento_nuevo NVARCHAR(100) NULL,
        provincia_anterior NVARCHAR(100) NULL,
        provincia_nuevo NVARCHAR(100) NULL,
        distrito_anterior NVARCHAR(100) NULL,
        distrito_nuevo NVARCHAR(100) NULL,
        referencia_anterior NVARCHAR(300) NULL,
        referencia_nuevo NVARCHAR(300) NULL;
    PRINT 'Columnas de ubigeo y referencia agregadas a colegiado_actualizaciones.';
END
ELSE
BEGIN
    PRINT 'Las columnas de ubigeo y referencia ya existen.';
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'colegiado_actualizaciones' AND COLUMN_NAME = 'estado_civil_nuevo'
)
BEGIN
    ALTER TABLE colegiado_actualizaciones ADD
        estado_civil_anterior VARCHAR(50) NULL,
        estado_civil_nuevo VARCHAR(50) NULL;
    PRINT 'Columnas de estado civil agregadas a colegiado_actualizaciones.';
END
ELSE
BEGIN
    PRINT 'Las columnas de estado civil ya existen.';
END
