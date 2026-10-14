-- ============================================================
-- 005: Reestructuracion de catalogos de configuracion
--  - IDs numericos IDENTITY (sin UUID ni codigo)
--  - Relaciones por FOREIGN KEY
-- Sistema de Beneficios Colegiales - APP_DB
-- ============================================================

-- ---------- 1) METODOS DE PAGO: id numerico + FK desde pagos ----------
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'metodos_pago')
BEGIN
  -- Respaldo de datos actuales
  IF OBJECT_ID('tempdb..#mp_old') IS NOT NULL DROP TABLE #mp_old;
  SELECT nombre, descripcion, requiere_referencia, activo
  INTO #mp_old FROM metodos_pago;

  DROP TABLE metodos_pago;

  CREATE TABLE metodos_pago (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL UNIQUE,
    descripcion NVARCHAR(300) NULL,
    requiere_referencia BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );

  INSERT INTO metodos_pago (nombre, descripcion, requiere_referencia, activo)
  SELECT nombre, descripcion, requiere_referencia, activo FROM #mp_old;
  PRINT 'metodos_pago reestructurada (id INT IDENTITY)';
END
GO

-- FK: pagos.metodo_pago_id -> metodos_pago.id
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pagos_metodos_pago'
)
BEGIN
  ALTER TABLE pagos ADD metodo_pago_id INT NULL
    REFERENCES metodos_pago(id);
  PRINT 'Columna pagos.metodo_pago_id agregada';
END
GO
-- (El historico de pagos esta vacio o se sincroniza por nombre en aplicacion)

-- ---------- 2) MONTOS FAM ----------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'montos_fam')
BEGIN
  CREATE TABLE montos_fam (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    aplica_a VARCHAR(50) NULL,          -- vinculo logico con tipos de beneficio FAM
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    descripcion NVARCHAR(300) NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );

  INSERT INTO montos_fam (nombre, aplica_a, monto, descripcion, activo)
  SELECT
    CASE c.clave
      WHEN 'FAM_MONTO_FALLECIMIENTO' THEN N'Fallecimiento del Titular'
      WHEN 'FAM_MONTO_ACCIDENTE'     THEN N'Accidente Grave que impide laborar'
      WHEN 'FAM_MONTO_ENFERMEDAD'    THEN N'Enfermedad Terminal o Invalidez Permanente'
      ELSE c.clave
    END,
    CASE c.clave
      WHEN 'FAM_MONTO_FALLECIMIENTO' THEN 'FALLECIMIENTO'
      WHEN 'FAM_MONTO_ACCIDENTE'     THEN 'INCAPACIDAD'
      WHEN 'FAM_MONTO_ENFERMEDAD'    THEN 'ENF_TERMINAL'
      ELSE NULL
    END,
    CAST(c.valor AS DECIMAL(12,2)), c.descripcion, c.activo
  FROM fam_configuracion c WHERE c.grupo = 'MONTO_FAM';
  PRINT 'montos_fam creada y migrada';
END
GO

-- ---------- 3) ESTADOS DE SOLICITUD ----------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'estados_solicitud')
BEGIN
  CREATE TABLE estados_solicitud (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(60) NOT NULL UNIQUE,
    descripcion NVARCHAR(300) NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );

  INSERT INTO estados_solicitud (nombre, descripcion, orden, activo)
  SELECT c.valor, c.descripcion,
    CASE c.clave
      WHEN 'PENDIENTE' THEN 1 WHEN 'EN_REVISION' THEN 2
      WHEN 'APROBADA' THEN 3 WHEN 'RECHAZADA' THEN 4
      WHEN 'PAGADA' THEN 5 ELSE 9 END,
    c.activo
  FROM fam_configuracion c WHERE c.grupo = 'ESTADO_SOLICITUD';
  PRINT 'estados_solicitud creada y migrada';
END
GO

-- ---------- 4) MONEDAS ----------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'monedas')
BEGIN
  CREATE TABLE monedas (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(60) NOT NULL UNIQUE,
    simbolo VARCHAR(10) NOT NULL,
    descripcion NVARCHAR(300) NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );

  INSERT INTO monedas (nombre, simbolo, descripcion, activo)
  SELECT c.valor,
    CASE c.clave WHEN 'PEN' THEN 'S/' WHEN 'USD' THEN '$' ELSE '' END,
    c.descripcion, c.activo
  FROM fam_configuracion c WHERE c.grupo = 'MONEDA';
  PRINT 'monedas creada y migrada';
END
GO

-- ---------- 5) TIPOS DE BENEFICIO (catalogo del modulo Beneficios) ----------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'tipos_beneficio_config')
BEGIN
  CREATE TABLE tipos_beneficio_config (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL UNIQUE,
    descripcion NVARCHAR(300) NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );

  INSERT INTO tipos_beneficio_config (nombre, descripcion, activo)
  SELECT c.valor, c.descripcion, c.activo
  FROM fam_configuracion c WHERE c.grupo = 'TIPO_BENEFICIO';
  PRINT 'tipos_beneficio_config creada y migrada';
END
GO

-- ---------- 6) Limpiar grupos migrados de fam_configuracion ----------
DELETE FROM fam_configuracion
WHERE grupo IN ('MONTO_FAM', 'ESTADO_SOLICITUD', 'MONEDA', 'TIPO_BENEFICIO');
GO
