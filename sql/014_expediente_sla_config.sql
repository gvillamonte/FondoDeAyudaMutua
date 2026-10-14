-- ============================================================
-- Migración 014: Tabla de configuración SLA para expedientes FAM
-- Almacena los tiempos límite (horas) por estado del flujo
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'expediente_sla_config')
BEGIN
  CREATE TABLE expediente_sla_config (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    estado          VARCHAR(30)   NOT NULL UNIQUE,
    nombre_visible  NVARCHAR(100) NOT NULL,
    horas_limite    INT           NOT NULL DEFAULT 72,
    color_badge     VARCHAR(20)   NOT NULL DEFAULT 'gray',
    orden_flujo     INT           NOT NULL DEFAULT 0,
    activo          BIT           NOT NULL DEFAULT 1,
    created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
  );

  -- Insertar valores por defecto del flujo de expedientes
  INSERT INTO expediente_sla_config (estado, nombre_visible, horas_limite, color_badge, orden_flujo) VALUES
    ('PENDIENTE',    'Pendiente',       48,  'amber',  1),
    ('EN_REVISION',  'En Revisión',     72,  'blue',   2),
    ('APROBADA',     'Aprobada',        24,  'green',  3),
    ('RECHAZADA',    'Rechazada',       0,   'red',    4),
    ('PAGADA',       'Pagada',          0,   'emerald',5);

  PRINT 'Tabla expediente_sla_config creada correctamente';
END
ELSE
  PRINT 'Tabla expediente_sla_config ya existe';
GO
