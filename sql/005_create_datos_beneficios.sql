-- =====================================================
-- 005: Tablas de datos de beneficios y tipos normalizados
-- Base de datos: DBCIPBeneficios (APP_DB)
-- =====================================================

-- Tabla normalizada: Tipos de Beneficio
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tipos_beneficio' AND xtype='U')
BEGIN
    CREATE TABLE tipos_beneficio (
        id              NVARCHAR(36)   NOT NULL PRIMARY KEY,
        codigo          VARCHAR(30)    NOT NULL,
        nombre          VARCHAR(100)   NOT NULL,
        descripcion     NVARCHAR(500)  NULL,
        programa        VARCHAR(20)    NOT NULL,   -- FAM, ISS
        activo          BIT            NOT NULL DEFAULT 1,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT UQ_tipos_beneficio_codigo_programa UNIQUE (codigo, programa)
    );

    PRINT 'Tabla tipos_beneficio creada exitosamente';
END
ELSE
    PRINT 'Tabla tipos_beneficio ya existe';
GO

-- Tabla principal: Datos de Beneficios
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='datos_beneficios' AND xtype='U')
BEGIN
    CREATE TABLE datos_beneficios (
        id                  NVARCHAR(36)   NOT NULL PRIMARY KEY,
        colegiado_id        VARCHAR(50)    NOT NULL,
        programa            VARCHAR(20)    NOT NULL,   -- FAM, ISS
        tipo_beneficio_id   NVARCHAR(36)   NOT NULL,
        monto               DECIMAL(12,2)  NOT NULL DEFAULT 0,
        moneda              VARCHAR(3)     NOT NULL DEFAULT 'PEN',
        estado              VARCHAR(30)    NOT NULL DEFAULT 'PENDIENTE',  -- PENDIENTE, APROBADO, RECHAZADO, PAGADO
        fecha_solicitud     DATETIME2      NOT NULL DEFAULT GETDATE(),
        fecha_resolucion    DATETIME2      NULL,
        fecha_pago          DATETIME2      NULL,
        observaciones       NVARCHAR(1000) NULL,
        registrado_por      NVARCHAR(36)   NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_datos_beneficios_tipo FOREIGN KEY (tipo_beneficio_id)
            REFERENCES tipos_beneficio(id)
    );

    CREATE INDEX IX_datos_beneficios_colegiado ON datos_beneficios(colegiado_id);
    CREATE INDEX IX_datos_beneficios_programa ON datos_beneficios(programa);
    CREATE INDEX IX_datos_beneficios_estado ON datos_beneficios(estado);
    CREATE INDEX IX_datos_beneficios_tipo ON datos_beneficios(tipo_beneficio_id);
    CREATE INDEX IX_datos_beneficios_fecha ON datos_beneficios(fecha_solicitud);

    PRINT 'Tabla datos_beneficios creada exitosamente';
END
ELSE
    INSERT INTO tipos_beneficio (id, codigo, nombre, descripcion, programa, activo, created_at)
    VALUES
        -- FAM
        ('TB-FAM-001', 'FALLECIMIENTO',  'Fallecimiento',    'Beneficio por fallecimiento del colegiado',        'FAM', 1, GETDATE()),
        ('TB-FAM-002', 'INCAPACIDAD',    'Incapacidad',      'Beneficio por incapacidad total o parcial',        'FAM', 1, GETDATE()),
        ('TB-FAM-003', 'ENF_TERMINAL',   'Enfermedad Terminal','Beneficio por enfermedad terminal del colegiado', 'FAM', 1, GETDATE()),
        -- ISS
        ('TB-ISS-001', 'FALLECIMIENTO',  'Fallecimiento',    'Beneficio ISS por fallecimiento',                 'ISS', 1, GETDATE()),
        ('TB-ISS-002', 'INCAPACIDAD',    'Incapacidad',      'Beneficio ISS por incapacidad',                   'ISS', 1, GETDATE()),
        ('TB-ISS-003', 'ENF_TERMINAL',   'Enfermedad Terminal','Beneficio ISS por enfermedad terminal',          'ISS', 1, GETDATE());

    PRINT 'Tabla datos_beneficios ya existe';
GO

-- Insertar tipos de beneficio iniciales
IF NOT EXISTS (SELECT 1 FROM tipos_beneficio)
BEGIN
    INSERT INTO tipos_beneficio (id, codigo, nombre, descripcion, programa, activo, created_at)
    VALUES
        ('TB-FAM-001', 'FALLECIMIENTO',  'Fallecimiento',    'Beneficio por fallecimiento del colegiado',        'FAM', 1, GETDATE()),
        ('TB-FAM-002', 'INCAPACIDAD',    'Incapacidad',      'Beneficio por incapacidad total o parcial',        'FAM', 1, GETDATE()),
        ('TB-FAM-003', 'ENF_TERMINAL',   'Enfermedad Terminal','Beneficio por enfermedad terminal del colegiado', 'FAM', 1, GETDATE()),
        ('TB-ISS-001', 'FALLECIMIENTO',  'Fallecimiento',    'Beneficio ISS por fallecimiento',                 'ISS', 1, GETDATE()),
        ('TB-ISS-002', 'INCAPACIDAD',    'Incapacidad',      'Beneficio ISS por incapacidad',                   'ISS', 1, GETDATE()),
        ('TB-ISS-003', 'ENF_TERMINAL',   'Enfermedad Terminal','Beneficio ISS por enfermedad terminal',          'ISS', 1, GETDATE());

    PRINT 'Tipos de beneficio iniciales insertados (6 registros)';
END
GO

-- Verificacion
SELECT 'tipos_beneficio' AS tabla, COUNT(*) AS registros FROM tipos_beneficio
UNION ALL
SELECT 'datos_beneficios', COUNT(*) FROM datos_beneficios;
GO
