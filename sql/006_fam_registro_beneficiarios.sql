-- ============================================================
-- 006: FAM Registro - Vinculo solicitud <-> beneficiarios
-- Registra quienes cobran cada solicitud de beneficio FAM
-- Sistema de Beneficios Colegiales - APP_DB
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'fam_solicitud_beneficiarios')
BEGIN
  CREATE TABLE fam_solicitud_beneficiarios (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    solicitud_id NVARCHAR(36) NOT NULL
      REFERENCES fam_solicitud_beneficio(id) ON DELETE CASCADE,
    beneficiario_id NVARCHAR(36) NOT NULL
      REFERENCES fam_beneficiarios(id),
    porcentaje_asignado DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_fam_sol_ben UNIQUE (solicitud_id, beneficiario_id)
  );
  PRINT 'Tabla fam_solicitud_beneficiarios creada';
END
ELSE
  PRINT 'Tabla fam_solicitud_beneficiarios ya existe';
GO
