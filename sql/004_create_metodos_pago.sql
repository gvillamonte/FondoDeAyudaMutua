-- ============================================================
-- 004: Tabla dedicada de METODOS DE PAGO
-- Sistema de Beneficios Colegiales - APP_DB
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'metodos_pago')
BEGIN
  CREATE TABLE metodos_pago (
    id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(300) NULL,
    requiere_referencia BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
  PRINT 'Tabla metodos_pago creada';
END
ELSE
  PRINT 'Tabla metodos_pago ya existe';
GO

-- Migrar metodos existentes desde fam_configuracion (grupo METODO_PAGO)
INSERT INTO metodos_pago (id, codigo, nombre, descripcion, activo)
SELECT c.id, c.clave, c.valor, c.descripcion, c.activo
FROM fam_configuracion c
WHERE c.grupo = 'METODO_PAGO'
  AND NOT EXISTS (SELECT 1 FROM metodos_pago m WHERE m.codigo = c.clave);
GO

-- Limpiar los registros migrados de fam_configuracion
DELETE FROM fam_configuracion WHERE grupo = 'METODO_PAGO';
GO
