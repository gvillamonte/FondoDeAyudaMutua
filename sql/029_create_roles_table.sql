-- ============================================================
-- 029_create_roles_table.sql
-- Creación de tabla de roles con módulos y permisos dinámicos
-- Eliminación de restricción CHECK fija en usuarios.rol
-- ============================================================

USE DBCIPBeneficios;
GO

-- 1. Crear tabla roles si no existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roles')
BEGIN
    CREATE TABLE roles (
        id              VARCHAR(50) PRIMARY KEY,
        nombre          VARCHAR(100) NOT NULL,
        descripcion     NVARCHAR(500) NULL,
        modulos         NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        activo          BIT NOT NULL DEFAULT 1,
        created_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 2. Eliminar la restricción CHECK fija sobre usuarios(rol) si existe
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('usuarios')
  AND definition LIKE '%rol%';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE usuarios DROP CONSTRAINT ' + @constraintName);
    PRINT 'Restriccion CHECK eliminada: ' + @constraintName;
END
GO

-- 3. Asegurar que usuarios.rol sea VARCHAR(50)
ALTER TABLE usuarios ALTER COLUMN rol VARCHAR(50) NOT NULL;
GO

-- 4. Insertar o actualizar roles predeterminados con sus módulos
IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'ADMINISTRADOR')
BEGIN
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES (
        'ADMINISTRADOR',
        'Administrador',
        'Acceso total a todos los modulos y configuraciones del sistema',
        '["dashboard","colegiados","actualizacion-datos","beneficios","pagos","caja","tesoreria","fam","reportes","configuraciones","auditoria","usuarios"]',
        1
    );
END
ELSE
BEGIN
    UPDATE roles
    SET modulos = '["dashboard","colegiados","actualizacion-datos","beneficios","pagos","caja","tesoreria","fam","reportes","configuraciones","auditoria","usuarios"]'
    WHERE id = 'ADMINISTRADOR';
END
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'OPERADOR_PAGOS')
BEGIN
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES (
        'OPERADOR_PAGOS',
        'Operador de Pagos',
        'Gestion de colegiados, beneficios, pagos y modulo FAM',
        '["dashboard","colegiados","beneficios","pagos","caja","fam"]',
        1
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 'AUDITOR')
BEGIN
    INSERT INTO roles (id, nombre, descripcion, modulos, activo)
    VALUES (
        'AUDITOR',
        'Auditor',
        'Acceso de consulta para reportes, auditoria y supervision',
        '["dashboard","colegiados","beneficios","pagos","reportes","auditoria"]',
        1
    );
END
GO
