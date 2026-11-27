-- ============================================================
-- 034: Bloqueo de Seguridad por Intentos Fallidos en Preguntas de Identidad
-- Bloquea por 24 horas a los colegiados que fallen 2 oportunidades en preguntas secretas
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('colegiado_seguridad_bloqueos') AND type = 'U')
BEGIN
    CREATE TABLE colegiado_seguridad_bloqueos (
        id                          NVARCHAR(36)     NOT NULL DEFAULT NEWID(),
        cip                         VARCHAR(50)      NOT NULL,
        dni                         VARCHAR(20)      NULL,
        intentos_fallidos           INT              NOT NULL DEFAULT 1,
        bloqueado_hasta             DATETIME2        NULL,
        ip_address                  VARCHAR(45)      NULL,
        motivo                      NVARCHAR(200)    NULL DEFAULT 'EXCESO_INTENTOS_PREGUNTAS',
        created_at                  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        updated_at                  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_colegiado_seguridad_bloqueos PRIMARY KEY CLUSTERED (id)
    );

    CREATE INDEX IX_colegiado_seguridad_bloqueos_cip ON colegiado_seguridad_bloqueos(cip);
    CREATE INDEX IX_colegiado_seguridad_bloqueos_hasta ON colegiado_seguridad_bloqueos(bloqueado_hasta);

    PRINT 'Tabla colegiado_seguridad_bloqueos creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla colegiado_seguridad_bloqueos ya existe';
END
GO
