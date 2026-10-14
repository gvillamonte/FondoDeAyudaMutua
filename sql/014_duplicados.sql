-- ============================================================
-- 014: Casos de beneficio DUPLICADO (auto + manual) con
-- documentacion propia en APP_DB (SQL Server)
-- ============================================================

-- Registro de casos duplicados (detectados automaticamente o
-- confirmados/descartados manualmente por un usuario)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('fam_duplicados') AND type = 'U')
BEGIN
    CREATE TABLE fam_duplicados (
        id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        colegiado_id        VARCHAR(50)      NOT NULL,
        tipo_beneficio_id   NVARCHAR(36)     NOT NULL,
        estado              VARCHAR(20)      NOT NULL DEFAULT 'DETECTADO', -- DETECTADO | CONFIRMADO | DESCARTADO
        motivo              NVARCHAR(500)    NULL,
        observaciones       NVARCHAR(1000)   NULL,
        expediente_ids      NVARCHAR(MAX)    NULL, -- JSON array de UUIDs de expedientes involucrados
        registrado_por      NVARCHAR(36)     NULL,
        created_at          DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        updated_at          DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_fam_duplicados PRIMARY KEY CLUSTERED (id)
    );

    CREATE INDEX IX_fam_duplicados_colegiado ON fam_duplicados(colegiado_id);
    CREATE INDEX IX_fam_duplicados_tipo ON fam_duplicados(tipo_beneficio_id);
    CREATE INDEX IX_fam_duplicados_estado ON fam_duplicados(estado);
END
GO

-- Documentacion propia del caso de duplicado (PDFs en base64)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('fam_duplicado_documentos') AND type = 'U')
BEGIN
    CREATE TABLE fam_duplicado_documentos (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        duplicado_id    UNIQUEIDENTIFIER NOT NULL,
        etiqueta        NVARCHAR(100)    NOT NULL,
        pdf_base64      NVARCHAR(MAX)    NOT NULL,
        registrado_por  NVARCHAR(36)     NULL,
        created_at      DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_fam_duplicado_documentos PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_fam_duplicado_documentos_duplicado FOREIGN KEY (duplicado_id)
            REFERENCES fam_duplicados(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_fam_duplicado_documentos_duplicado ON fam_duplicado_documentos(duplicado_id);
END
GO
