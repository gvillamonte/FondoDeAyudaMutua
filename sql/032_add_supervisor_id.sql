-- Migración 032: Añadir columna supervisor_id a la tabla usuarios para modelar supervisión de equipos
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'supervisor_id'
)
BEGIN
    ALTER TABLE usuarios ADD supervisor_id UNIQUEIDENTIFIER NULL;
END
ELSE
BEGIN
    -- Si se creó previamente con otro tipo, homologar a UNIQUEIDENTIFIER
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'supervisor_id' AND DATA_TYPE <> 'uniqueidentifier'
    )
    BEGIN
        ALTER TABLE usuarios ALTER COLUMN supervisor_id UNIQUEIDENTIFIER NULL;
    END
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys 
    WHERE name = 'FK_usuarios_supervisor'
)
BEGIN
    ALTER TABLE usuarios ADD CONSTRAINT FK_usuarios_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES usuarios(id);
END;
