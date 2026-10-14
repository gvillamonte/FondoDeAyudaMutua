-- ============================================================
-- 011: Catálogos de Memorándums y Cartas
-- Tablas propias en APP_DB, conectadas vía FK al dominio FAM
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('memorandos') AND type = 'U')
BEGIN
    CREATE TABLE memorandos (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        numero      NVARCHAR(50)     NOT NULL,
        fecha       DATETIME2        NULL,
        asunto      NVARCHAR(255)    NULL,
        activo      BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_memorandos PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_memorandos_numero UNIQUE (numero)
    );

    CREATE INDEX IX_memorandos_activo ON memorandos(activo);
    CREATE INDEX IX_memorandos_numero ON memorandos(numero);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('cartas') AND type = 'U')
BEGIN
    CREATE TABLE cartas (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        numero      NVARCHAR(50)     NOT NULL,
        fecha       DATETIME2        NULL,
        referencia  NVARCHAR(255)    NULL,
        activo      BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_cartas PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_cartas_numero UNIQUE (numero)
    );

    CREATE INDEX IX_cartas_activo ON cartas(activo);
    CREATE INDEX IX_cartas_numero ON cartas(numero);
END
GO
