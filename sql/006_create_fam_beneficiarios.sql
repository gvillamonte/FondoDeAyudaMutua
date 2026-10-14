-- =====================================================
-- 006: Tablas para registro de beneficiarios FAM e imagenes
-- Base de datos: DBCIPBeneficios (APP_DB)
-- =====================================================

-- Tabla de beneficiarios registrados en el sistema
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fam_beneficiarios' AND xtype='U')
BEGIN
    CREATE TABLE fam_beneficiarios (
        id              NVARCHAR(36)   NOT NULL PRIMARY KEY,
        colegiado_id    VARCHAR(50)    NOT NULL,
        nombre          VARCHAR(200)   NOT NULL,
        dni             VARCHAR(20)    NULL,
        parentesco      VARCHAR(30)    NOT NULL,
        porcentaje      DECIMAL(5,2)   NOT NULL DEFAULT 0,
        activo          BIT            NOT NULL DEFAULT 1,
        observaciones   NVARCHAR(500)  NULL,
        registrado_por  NVARCHAR(36)   NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2      NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_fam_beneficiarios_colegiado ON fam_beneficiarios(colegiado_id);
    CREATE INDEX IX_fam_beneficiarios_activo ON fam_beneficiarios(activo);

    PRINT 'Tabla fam_beneficiarios creada exitosamente';
END
ELSE
    PRINT 'Tabla fam_beneficiarios ya existe';
GO

-- Tabla de imagenes de beneficiarios (almacenadas en base64)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fam_imagenes_beneficiario' AND xtype='U')
BEGIN
    CREATE TABLE fam_imagenes_beneficiario (
        id                  NVARCHAR(36)   NOT NULL PRIMARY KEY,
        beneficiario_id     NVARCHAR(36)   NOT NULL,
        dni_cara            NVARCHAR(MAX)  NULL,
        dni_reverso         NVARCHAR(MAX)  NULL,
        carta_declaratoria  NVARCHAR(MAX)  NULL,
        sucesion_intestada  NVARCHAR(MAX)  NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_famimagenes_beneficiario FOREIGN KEY (beneficiario_id)
            REFERENCES fam_beneficiarios(id)
    );

    CREATE UNIQUE INDEX IX_fam_imagenes_beneficiario_id ON fam_imagenes_beneficiario(beneficiario_id);

    PRINT 'Tabla fam_imagenes_beneficiario creada exitosamente';
END
ELSE
    PRINT 'Tabla fam_imagenes_beneficiario ya existe';
GO

-- Verificacion
SELECT 'fam_beneficiarios' AS tabla, COUNT(*) AS registros FROM fam_beneficiarios
UNION ALL
SELECT 'fam_imagenes_beneficiario', COUNT(*) FROM fam_imagenes_beneficiario;
GO
