-- ============================================================
-- 030_seed_roles_areas.sql
-- Catálogo institucional de roles por áreas del CIP Cusco
-- ============================================================

USE DBCIPBeneficios;
GO

-- 1. ADMINISTRADOR GENERAL
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'ADMINISTRADOR')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('ADMINISTRADOR', 'Administrador General', 'Acceso total y configuración integral de todos los módulos del sistema', '["dashboard","colegiados","actualizacion-datos","beneficios","pagos","caja","tesoreria","fam","reportes","configuraciones","auditoria","usuarios"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Administrador General',
        descripcion = 'Acceso total y configuración integral de todos los módulos del sistema',
        modulos = '["dashboard","colegiados","actualizacion-datos","beneficios","pagos","caja","tesoreria","fam","reportes","configuraciones","auditoria","usuarios"]',
        activo = 1
    WHERE id = 'ADMINISTRADOR';

-- 2. OPERADOR FAM (Área Fondo Asistencia Mutua)
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'OPERADOR_FAM')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('OPERADOR_FAM', 'Operador FAM', 'Área FAM: Registro y seguimiento de beneficiarios, subsidios y expedientes', '["dashboard","colegiados","fam","beneficios","reportes"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Operador FAM',
        descripcion = 'Área FAM: Registro y seguimiento de beneficiarios, subsidios y expedientes',
        modulos = '["dashboard","colegiados","fam","beneficios","reportes"]',
        activo = 1
    WHERE id = 'OPERADOR_FAM';

-- 3. SUPERVISOR / JEFATURA FAM
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'SUPERVISOR_FAM')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('SUPERVISOR_FAM', 'Supervisor / Jefatura FAM', 'Jefatura FAM: Aprobación, fiscalización, configuración SLA y reportes de expedientes', '["dashboard","colegiados","fam","beneficios","pagos","reportes","configuraciones"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Supervisor / Jefatura FAM',
        descripcion = 'Jefatura FAM: Aprobación, fiscalización, configuración SLA y reportes de expedientes',
        modulos = '["dashboard","colegiados","fam","beneficios","pagos","reportes","configuraciones"]',
        activo = 1
    WHERE id = 'SUPERVISOR_FAM';

-- 4. CAJERO / COBRANZAS (Área de Caja)
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'CAJERO')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('CAJERO', 'Cajero / Cobranzas', 'Área de Caja: Cobro de aportaciones ordinarias, IEPI, derechos y consulta de pagos', '["dashboard","colegiados","caja","pagos"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Cajero / Cobranzas',
        descripcion = 'Área de Caja: Cobro de aportaciones ordinarias, IEPI, derechos y consulta de pagos',
        modulos = '["dashboard","colegiados","caja","pagos"]',
        activo = 1
    WHERE id = 'CAJERO';

-- 5. TESORERÍA Y FINANZAS
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'TESORERIA')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('TESORERIA', 'Tesorería y Finanzas', 'Área de Tesorería: Fraccionamiento de deudas, convenios de pago y control financiero', '["dashboard","colegiados","tesoreria","caja","pagos","reportes"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Tesorería y Finanzas',
        descripcion = 'Área de Tesorería: Fraccionamiento de deudas, convenios de pago y control financiero',
        modulos = '["dashboard","colegiados","tesoreria","caja","pagos","reportes"]',
        activo = 1
    WHERE id = 'TESORERIA';

-- 6. ATENCIÓN AL COLEGIADO / MESA DE PARTES
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'MESA_PARTES')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('MESA_PARTES', 'Atención al Colegiado / Mesa de Partes', 'Atención: Recepción de solicitudes, actualización de datos y verificación de habilidad', '["dashboard","colegiados","actualizacion-datos","reportes"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Atención al Colegiado / Mesa de Partes',
        descripcion = 'Atención: Recepción de solicitudes, actualización de datos y verificación de habilidad',
        modulos = '["dashboard","colegiados","actualizacion-datos","reportes"]',
        activo = 1
    WHERE id = 'MESA_PARTES';

-- 7. AUDITORÍA Y CONTROL INTERNO
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'AUDITOR')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('AUDITOR', 'Auditoría y Control Interno', 'Control Interno: Supervisión de trazabilidad, logs inmutables y reportes globales', '["dashboard","colegiados","beneficios","pagos","reportes","auditoria"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Auditoría y Control Interno',
        descripcion = 'Control Interno: Supervisión de trazabilidad, logs inmutables y reportes globales',
        modulos = '["dashboard","colegiados","beneficios","pagos","reportes","auditoria"]',
        activo = 1
    WHERE id = 'AUDITOR';

-- 8. DECANATO Y JUNTA DIRECTIVA
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'DIRECTORIO')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('DIRECTORIO', 'Decanato y Junta Directiva', 'Alta Dirección: Consulta ejecutiva de indicadores, recaudación, estados y padrón', '["dashboard","colegiados","fam","caja","tesoreria","reportes","auditoria"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Decanato y Junta Directiva',
        descripcion = 'Alta Dirección: Consulta ejecutiva de indicadores, recaudación, estados y padrón',
        modulos = '["dashboard","colegiados","fam","caja","tesoreria","reportes","auditoria"]',
        activo = 1
    WHERE id = 'DIRECTORIO';

-- 9. SOPORTE Y SISTEMAS TI
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'SOPORTE_TI')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('SOPORTE_TI', 'Soporte y Sistemas TI', 'Área de TI: Administración técnica de usuarios, roles, configuraciones y auditoría', '["dashboard","configuraciones","auditoria","usuarios"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Soporte y Sistemas TI',
        descripcion = 'Área de TI: Administración técnica de usuarios, roles, configuraciones y auditoría',
        modulos = '["dashboard","configuraciones","auditoria","usuarios"]',
        activo = 1
    WHERE id = 'SOPORTE_TI';

-- 10. OPERADOR DE PAGOS Y BENEFICIOS
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'OPERADOR_PAGOS')
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES ('OPERADOR_PAGOS', 'Operador de Pagos y Beneficios', 'Área de Pagos: Gestión operativa de pagos, órdenes de desembolso y beneficios', '["dashboard","colegiados","beneficios","pagos","caja","fam"]', 1);
ELSE
    UPDATE roles
    SET nombre = 'Operador de Pagos y Beneficios',
        descripcion = 'Área de Pagos: Gestión operativa de pagos, órdenes de desembolso y beneficios',
        modulos = '["dashboard","colegiados","beneficios","pagos","caja","fam"]',
        activo = 1
    WHERE id = 'OPERADOR_PAGOS';
GO
