-- ============================================================
-- 012: Asignaciones de Ayuda COVID + vínculos con beneficiarios
-- Registra colegiados que recibieron monto por COVID (~S/200)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('fam_covid_asignaciones') AND type = 'U')
BEGIN
    CREATE TABLE fam_covid_asignaciones (
        id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        colegiado_id          NVARCHAR(20)     NOT NULL,
        cip                   NVARCHAR(20)     NULL,
        dni                   NVARCHAR(20)     NULL,
        nombre_colegiado      NVARCHAR(200)    NULL,
        modalidad_beneficio   NVARCHAR(30)     NOT NULL DEFAULT 'monto_unico',
        monto                 DECIMAL(12, 2)   NOT NULL DEFAULT 200,
        fecha_pago            DATETIME2        NULL,
        fecha_registro        DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        solicitante_beneficiario_id NVARCHAR(36) NULL,
        solicitante_nombre    NVARCHAR(200)    NULL,
        solicitante_dni       VARCHAR(20)      NULL,
        memorando_id          UNIQUEIDENTIFIER NULL,
        carta_id              UNIQUEIDENTIFIER NULL,
        observaciones         NVARCHAR(MAX)    NULL,
        activo                BIT              NOT NULL DEFAULT 1,
        registrado_por        NVARCHAR(100)    NULL,
        created_at            DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
        updated_at            DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_fam_covid_asignaciones PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_fam_covid_memorando FOREIGN KEY (memorando_id) REFERENCES memorandos(id) ON DELETE NO ACTION,
        CONSTRAINT FK_fam_covid_carta FOREIGN KEY (carta_id) REFERENCES cartas(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_fam_covid_colegiado ON fam_covid_asignaciones(colegiado_id);
    CREATE INDEX IX_fam_covid_activo ON fam_covid_asignaciones(activo);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('fam_covid_asignacion_beneficiarios') AND type = 'U')
BEGIN
    CREATE TABLE fam_covid_asignacion_beneficiarios (
        id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        covid_asignacion_id    UNIQUEIDENTIFIER NOT NULL,
        beneficiario_id        NVARCHAR(36)     NOT NULL,
        porcentaje_asignado    DECIMAL(5, 2)    NOT NULL DEFAULT 0,
        orden                  INT              NULL,
        created_at             DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT PK_fam_covid_asig_ben PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_fam_covid_asig_ben_asignacion FOREIGN KEY (covid_asignacion_id)
            REFERENCES fam_covid_asignaciones(id) ON DELETE CASCADE,
        CONSTRAINT FK_fam_covid_asig_ben_beneficiario FOREIGN KEY (beneficiario_id)
            REFERENCES fam_beneficiarios(id),
        CONSTRAINT UQ_fam_covid_asig_ben UNIQUE (covid_asignacion_id, beneficiario_id)
    );

    CREATE INDEX IX_fam_covid_asig_ben_asignacion ON fam_covid_asignacion_beneficiarios(covid_asignacion_id);
END
GO
