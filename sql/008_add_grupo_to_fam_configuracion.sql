-- =====================================================
-- 008: Agregar campo grupo a fam_configuracion
-- Base de datos: DBCIPBeneficios (APP_DB)
-- =====================================================

-- Agregar columna grupo si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('fam_configuracion') AND name = 'grupo')
BEGIN
    ALTER TABLE fam_configuracion ADD grupo VARCHAR(30) NOT NULL DEFAULT 'GENERAL';
    PRINT 'Columna grupo agregada a fam_configuracion';
END
ELSE
    PRINT 'Columna grupo ya existe en fam_configuracion';
GO

-- Actualizar registros existentes con grupo MONTO_FAM
UPDATE fam_configuracion SET grupo = 'MONTO_FAM' WHERE clave LIKE 'FAM_MONTO_%';
GO

-- Insertar Métodos de Pago
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'TRANSFERENCIA')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
    VALUES
        ('CFG-MP-001', 'TRANSFERENCIA', 'Transferencia Bancaria', 'METODO_PAGO', 'Pago mediante transferencia bancaria', 1, GETDATE(), GETDATE()),
        ('CFG-MP-002', 'DEPOSITO', 'Depósito en Cuenta', 'METODO_PAGO', 'Pago mediante depósito en cuenta bancaria', 1, GETDATE(), GETDATE()),
        ('CFG-MP-003', 'CHEQUE', 'Cheque', 'METODO_PAGO', 'Pago mediante cheque', 1, GETDATE(), GETDATE()),
        ('CFG-MP-004', 'EFECTIVO', 'Efectivo', 'METODO_PAGO', 'Pago en efectivo', 1, GETDATE(), GETDATE());
    PRINT 'Métodos de pago insertados';
END
GO

-- Insertar Estados de Solicitud
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'PENDIENTE')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
    VALUES
        ('CFG-ES-001', 'PENDIENTE', 'Pendiente', 'ESTADO_SOLICITUD', 'Solicitud recibida, pendiente de revisión', 1, GETDATE(), GETDATE()),
        ('CFG-ES-002', 'EN_REVISION', 'En Revisión', 'ESTADO_SOLICITUD', 'Solicitud en proceso de revisión', 1, GETDATE(), GETDATE()),
        ('CFG-ES-003', 'APROBADA', 'Aprobada', 'ESTADO_SOLICITUD', 'Solicitud aprobada para pago', 1, GETDATE(), GETDATE()),
        ('CFG-ES-004', 'RECHAZADA', 'Rechazada', 'ESTADO_SOLICITUD', 'Solicitud rechazada', 1, GETDATE(), GETDATE()),
        ('CFG-ES-005', 'PAGADA', 'Pagada', 'ESTADO_SOLICITUD', 'Solicitud pagada exitosamente', 1, GETDATE(), GETDATE());
    PRINT 'Estados de solicitud insertados';
END
GO

-- Insertar Tipos de Beneficio
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'ASISTENCIA_ECONOMICA')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
    VALUES
        ('CFG-TB-001', 'ASISTENCIA_ECONOMICA', 'Asistencia Económica', 'TIPO_BENEFICIO', 'Ayuda económica directa al colegiado', 1, GETDATE(), GETDATE()),
        ('CFG-TB-002', 'CAPACITACION', 'Capacitación', 'TIPO_BENEFICIO', 'Beneficio para cursos y capacitaciones', 1, GETDATE(), GETDATE()),
        ('CFG-TB-003', 'SEGURO', 'Seguro', 'TIPO_BENEFICIO', 'Cobertura de seguro al colegiado', 1, GETDATE(), GETDATE()),
        ('CFG-TB-004', 'BONO', 'Bono', 'TIPO_BENEFICIO', 'Bono económico por eventos especiales', 1, GETDATE(), GETDATE()),
        ('CFG-TB-005', 'OTRO', 'Otro', 'TIPO_BENEFICIO', 'Otro tipo de beneficio no clasificado', 1, GETDATE(), GETDATE());
    PRINT 'Tipos de beneficio insertados';
END
GO

-- Insertar Monedas
IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'PEN')
BEGIN
    INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
    VALUES
        ('CFG-MN-001', 'PEN', 'Sol Peruano', 'MONEDA', 'Moneda nacional del Perú (S/)', 1, GETDATE(), GETDATE()),
        ('CFG-MN-002', 'USD', 'Dólar Americano', 'MONEDA', 'Moneda de los Estados Unidos ($)', 1, GETDATE(), GETDATE());
    PRINT 'Monedas insertadas';
END
GO

-- Verificación
SELECT grupo, COUNT(*) AS registros
FROM fam_configuracion
GROUP BY grupo
ORDER BY grupo;
GO
