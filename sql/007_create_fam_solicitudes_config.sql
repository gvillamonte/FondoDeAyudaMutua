-- =====================================================
-- 007: Tablas de solicitudes FAM y configuración
-- Base de datos: DBCIPBeneficios (APP_DB)
-- =====================================================

-- Tabla de solicitudes de beneficio FAM
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fam_solicitud_beneficio' AND xtype='U')
BEGIN
    CREATE TABLE fam_solicitud_beneficio (
        id                  NVARCHAR(36)   NOT NULL PRIMARY KEY,
        colegiado_id        VARCHAR(50)    NOT NULL,
        tipo_beneficio_id   NVARCHAR(36)   NOT NULL,
        monto               DECIMAL(12,2)  NOT NULL DEFAULT 0,
        moneda              VARCHAR(3)     NOT NULL DEFAULT 'PEN',
        estado              VARCHAR(30)    NOT NULL DEFAULT 'PENDIENTE',
        fecha_solicitud     DATETIME2      NOT NULL DEFAULT GETDATE(),
        fecha_resolucion    DATETIME2      NULL,
        observaciones       NVARCHAR(1000) NULL,
        registrado_por      NVARCHAR(36)   NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),

        -- Documentos: Ficha de admisibilidad
        ficha_admisibilidad NVARCHAR(MAX)  NULL,

        -- Documentos: Solicitud de asignación por fallecimiento
        solicitud_asignacion NVARCHAR(MAX) NULL,

        -- Documentos: Carta de remisión de expediente
        carta_remision      NVARCHAR(MAX)  NULL,
        carta_numero        VARCHAR(50)    NULL,
        expediente_numero   VARCHAR(50)    NULL,
        carta_fecha         DATETIME2      NULL,

        -- Documentos: Memorándum referente a la carta
        memorando           NVARCHAR(MAX)  NULL,
        memorando_numero    VARCHAR(50)    NULL,
        memorando_fecha     DATETIME2      NULL,

        -- Documentos: Orden de pago
        orden_pago          NVARCHAR(MAX)  NULL,
        forma_pago          VARCHAR(30)    NULL,
        banco               VARCHAR(100)   NULL,
        orden_pago_fecha    DATETIME2      NULL,

        CONSTRAINT FK_fam_solicitud_tipo FOREIGN KEY (tipo_beneficio_id)
            REFERENCES tipos_beneficio(id)
    );

    CREATE INDEX IX_fam_solicitud_colegiado ON fam_solicitud_beneficio(colegiado_id);
    CREATE INDEX IX_fam_solicitud_tipo ON fam_solicitud_beneficio(tipo_beneficio_id);
    CREATE INDEX IX_fam_solicitud_estado ON fam_solicitud_beneficio(estado);
    CREATE INDEX IX_fam_solicitud_fecha ON fam_solicitud_beneficio(fecha_solicitud);

    PRINT 'Tabla fam_solicitud_beneficio creada exitosamente';
END
ELSE
    PRINT 'Tabla fam_solicitud_beneficio ya existe';
GO

-- Tabla de configuración FAM
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fam_configuracion' AND xtype='U')
BEGIN
    CREATE TABLE fam_configuracion (
        id          NVARCHAR(36)   NOT NULL PRIMARY KEY,
        clave       VARCHAR(100)   NOT NULL,
        valor       NVARCHAR(500)  NOT NULL,
        descripcion NVARCHAR(500)  NULL,
        activo      BIT            NOT NULL DEFAULT 1,
        created_at  DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at  DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT UQ_fam_configuracion_clave UNIQUE (clave)
    );

    PRINT 'Tabla fam_configuracion creada exitosamente';
END
ELSE
    PRINT 'Tabla fam_configuracion ya existe';
GO

-- Insertar configuraciones predeterminadas para montos FAM
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'FAM_MONTO_FALLECIMIENTO')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, descripcion, activo, created_at, updated_at)
    VALUES
        ('CFG-FAM-001', 'FAM_MONTO_FALLECIMIENTO', '3000', 'Monto predeterminado para Fallecimiento del titular (S/)', 1, GETDATE(), GETDATE()),
        ('CFG-FAM-002', 'FAM_MONTO_ACCIDENTE', '2000', 'Monto predeterminado para Accidente grave que impide laborar (S/)', 1, GETDATE(), GETDATE()),
        ('CFG-FAM-003', 'FAM_MONTO_ENFERMEDAD', '2000', 'Monto predeterminado para Enfermedad terminal o invalidez permanente (S/)', 1, GETDATE(), GETDATE());

    PRINT 'Configuraciones FAM predeterminadas insertadas';
END
GO

-- Verificación
SELECT 'fam_solicitud_beneficio' AS tabla, COUNT(*) AS registros FROM fam_solicitud_beneficio
UNION ALL
SELECT 'fam_configuracion', COUNT(*) FROM fam_configuracion;
GO
