-- ============================================================
-- 023: Actualización de Datos de Colegiados (Autoservicio y Auditoría)
-- Permite registrar cambios de correo, celular, fecha de nacimiento y sexo
-- realizados por los colegiados o verificados por administración.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('colegiado_actualizaciones') AND type = 'U')
BEGIN
    CREATE TABLE colegiado_actualizaciones (
        id                          NVARCHAR(36)     NOT NULL DEFAULT NEWID(),
        colegiado_id                VARCHAR(50)      NOT NULL,
        cip                         VARCHAR(50)      NOT NULL,
        dni                         VARCHAR(20)      NOT NULL,
        nombres                     NVARCHAR(200)    NOT NULL,
        email_anterior              VARCHAR(255)     NULL,
        email_nuevo                 VARCHAR(255)     NULL,
        celular_anterior            VARCHAR(50)      NULL,
        celular_nuevo               VARCHAR(50)      NULL,
        fecha_nacimiento_anterior   VARCHAR(50)      NULL,
        fecha_nacimiento_nuevo      VARCHAR(50)      NULL,
        sexo_anterior               VARCHAR(20)      NULL,
        sexo_nuevo                  VARCHAR(20)      NULL,
        direccion_anterior          NVARCHAR(300)    NULL,
        direccion_nuevo             NVARCHAR(300)    NULL,
        ip_address                  VARCHAR(45)      NULL,
        user_agent                  VARCHAR(500)     NULL,
        estado                      VARCHAR(30)      NOT NULL DEFAULT 'ACTUALIZADO',
        created_at                  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        updated_at                  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_colegiado_actualizaciones PRIMARY KEY CLUSTERED (id)
    );

    CREATE INDEX IX_colegiado_actualizaciones_colegiado ON colegiado_actualizaciones(colegiado_id);
    CREATE INDEX IX_colegiado_actualizaciones_cip ON colegiado_actualizaciones(cip);
    CREATE INDEX IX_colegiado_actualizaciones_dni ON colegiado_actualizaciones(dni);
    CREATE INDEX IX_colegiado_actualizaciones_created_at ON colegiado_actualizaciones(created_at);

    PRINT 'Tabla colegiado_actualizaciones creada correctamente';
END
ELSE
BEGIN
    PRINT 'Tabla colegiado_actualizaciones ya existe';
END
GO
