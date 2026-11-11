const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('-> Verificando y ejecutando migración de columnas en DBCIPBeneficios...');
  
  const queries = [
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'colegiado_actualizaciones' AND COLUMN_NAME = 'departamento_nuevo')
     BEGIN
       ALTER TABLE colegiado_actualizaciones ADD
         departamento_anterior NVARCHAR(100) NULL,
         departamento_nuevo NVARCHAR(100) NULL,
         provincia_anterior NVARCHAR(100) NULL,
         provincia_nuevo NVARCHAR(100) NULL,
         distrito_anterior NVARCHAR(100) NULL,
         distrito_nuevo NVARCHAR(100) NULL,
         referencia_anterior NVARCHAR(300) NULL,
         referencia_nuevo NVARCHAR(300) NULL;
       PRINT 'Columnas de ubigeo y referencia agregadas.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'colegiado_actualizaciones' AND COLUMN_NAME = 'estado_civil_nuevo')
     BEGIN
       ALTER TABLE colegiado_actualizaciones ADD
         estado_civil_anterior VARCHAR(50) NULL,
         estado_civil_nuevo VARCHAR(50) NULL;
       PRINT 'Columnas de estado civil agregadas.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'otros_documentos')
     BEGIN
       ALTER TABLE fam_solicitud_beneficio ADD otros_documentos NVARCHAR(MAX) NULL;
       PRINT 'Columna otros_documentos agregada en fam_solicitud_beneficio.';
     END`,
    `IF OBJECT_ID('fam_sucesiones_intestadas', 'U') IS NULL
     BEGIN
       CREATE TABLE fam_sucesiones_intestadas (
         id NVARCHAR(36) NOT NULL PRIMARY KEY,
         solicitud_id NVARCHAR(36) NOT NULL UNIQUE REFERENCES fam_solicitud_beneficio(id) ON DELETE CASCADE,
         colegiado_id VARCHAR(50) NOT NULL,
         numero_partida_registral VARCHAR(50) NULL,
         notaria_juzgado NVARCHAR(200) NULL,
         fecha_emision_documento DATETIME2 NULL,
         sustento_pdf NVARCHAR(MAX) NOT NULL,
         monto_total DECIMAL(12,2) NOT NULL,
         estado_tramite VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
         version_actual INT NOT NULL DEFAULT 1,
         observaciones NVARCHAR(1000) NULL,
         registrado_por NVARCHAR(36) NULL,
         created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
         updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
       );
       CREATE INDEX IX_fam_sucesiones_colegiado ON fam_sucesiones_intestadas(colegiado_id);
       CREATE INDEX IX_fam_sucesiones_solicitud ON fam_sucesiones_intestadas(solicitud_id);
       PRINT 'Tabla fam_sucesiones_intestadas creada.';
     END`,
    `IF OBJECT_ID('fam_sucesion_beneficiarios', 'U') IS NULL
     BEGIN
       CREATE TABLE fam_sucesion_beneficiarios (
         id NVARCHAR(36) NOT NULL PRIMARY KEY,
         sucesion_id NVARCHAR(36) NOT NULL REFERENCES fam_sucesiones_intestadas(id) ON DELETE CASCADE,
         beneficiario_id NVARCHAR(36) NULL REFERENCES fam_beneficiarios(id),
         tipo_documento VARCHAR(10) NOT NULL DEFAULT 'DNI',
         numero_documento VARCHAR(20) NOT NULL,
         nombres NVARCHAR(100) NOT NULL,
         apellidos NVARCHAR(100) NOT NULL,
         parentesco VARCHAR(50) NOT NULL,
         porcentaje DECIMAL(5,2) NOT NULL,
         monto DECIMAL(12,2) NOT NULL,
         telefono VARCHAR(30) NULL,
         email VARCHAR(150) NULL,
         declaracion_jurada_pdf NVARCHAR(MAX) NULL,
         orden_pago_pdf NVARCHAR(MAX) NULL,
         orden INT NOT NULL DEFAULT 1,
         created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
         CONSTRAINT UQ_sucesion_documento UNIQUE (sucesion_id, tipo_documento, numero_documento)
       );
       CREATE INDEX IX_sucesion_ben_sucesion ON fam_sucesion_beneficiarios(sucesion_id);
       PRINT 'Tabla fam_sucesion_beneficiarios creada.';
     END`,
    `IF OBJECT_ID('fam_sucesion_versiones', 'U') IS NULL
     BEGIN
       CREATE TABLE fam_sucesion_versiones (
         id NVARCHAR(36) NOT NULL PRIMARY KEY,
         sucesion_id NVARCHAR(36) NOT NULL REFERENCES fam_sucesiones_intestadas(id) ON DELETE CASCADE,
         numero_version INT NOT NULL,
         snapshot_distribucion_json NVARCHAR(MAX) NOT NULL,
         motivo_modificacion NVARCHAR(500) NOT NULL,
         modificado_por NVARCHAR(36) NULL,
         ip_address VARCHAR(45) NULL,
         created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
         CONSTRAINT UQ_sucesion_version UNIQUE (sucesion_id, numero_version)
       );
       CREATE INDEX IX_sucesion_versiones_sucesion ON fam_sucesion_versiones(sucesion_id);
       PRINT 'Tabla fam_sucesion_versiones creada.';
     END`,
    `IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_sucesiones_intestadas' AND COLUMN_NAME = 'sustento_pdf' AND IS_NULLABLE = 'NO')
     BEGIN
       ALTER TABLE fam_sucesiones_intestadas ALTER COLUMN sustento_pdf NVARCHAR(MAX) NULL;
       PRINT 'Columna sustento_pdf modificada a NULL.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_sucesiones_intestadas' AND COLUMN_NAME = 'observacion_sin_sucesion')
     BEGIN
       ALTER TABLE fam_sucesiones_intestadas ADD observacion_sin_sucesion NVARCHAR(1000) NULL;
       PRINT 'Columna observacion_sin_sucesion agregada.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'montoMinimoFallecimiento')
     BEGIN
       INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
       VALUES (NEWID(), 'montoMinimoFallecimiento', '3000.00', 'FAM_PARAMETROS', 'Monto mínimo normativo total requerido para beneficiarios por fallecimiento (S/)', 1, GETDATE(), GETDATE());
       PRINT 'Configuracion montoMinimoFallecimiento creada.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM fam_configuracion WHERE clave = 'ALERTA_SALDO_PENDIENTE_ENABLED')
     BEGIN
       INSERT INTO fam_configuracion (id, clave, valor, grupo, descripcion, activo, created_at, updated_at)
       VALUES (NEWID(), 'ALERTA_SALDO_PENDIENTE_ENABLED', 'true', 'FEATURE_FLAGS', 'Activa o desactiva la alerta no bloqueante de saldo pendiente al guardar expedientes', 1, GETDATE(), GETDATE());
       PRINT 'Feature flag ALERTA_SALDO_PENDIENTE_ENABLED creado.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'monto_total_asignado')
     BEGIN
       ALTER TABLE fam_solicitud_beneficio ADD monto_total_asignado DECIMAL(12, 2) NULL;
       PRINT 'Columna monto_total_asignado agregada en fam_solicitud_beneficio.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'saldo_pendiente')
     BEGIN
       ALTER TABLE fam_solicitud_beneficio ADD saldo_pendiente DECIMAL(12, 2) NULL DEFAULT 0.00;
       PRINT 'Columna saldo_pendiente agregada en fam_solicitud_beneficio.';
     END`,
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fam_solicitud_beneficio' AND COLUMN_NAME = 'tiene_saldo_pendiente')
     BEGIN
       ALTER TABLE fam_solicitud_beneficio ADD tiene_saldo_pendiente BIT NOT NULL DEFAULT 0;
       PRINT 'Columna tiene_saldo_pendiente agregada en fam_solicitud_beneficio.';
     END`,
    `IF OBJECT_ID('expediente_beneficiario_audit', 'U') IS NULL
     BEGIN
       CREATE TABLE expediente_beneficiario_audit (
         id NVARCHAR(36) NOT NULL PRIMARY KEY,
         expediente_id NVARCHAR(36) NOT NULL,
         accion VARCHAR(50) NOT NULL,
         usuario_id NVARCHAR(36) NOT NULL,
         fecha DATETIME2 NOT NULL DEFAULT GETDATE(),
         monto_faltante DECIMAL(12, 2) NOT NULL DEFAULT 0,
         monto_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
         detalle_json NVARCHAR(MAX) NULL,
         ip_address VARCHAR(45) NULL,
         CONSTRAINT FK_exp_ben_audit_expediente FOREIGN KEY (expediente_id) REFERENCES fam_solicitud_beneficio(id) ON DELETE CASCADE
       );
       CREATE INDEX IX_exp_ben_audit_expediente ON expediente_beneficiario_audit(expediente_id);
       CREATE INDEX IX_exp_ben_audit_fecha ON expediente_beneficiario_audit(fecha);
       PRINT 'Tabla expediente_beneficiario_audit creada.';
     END`,
    `UPDATE fam_solicitud_beneficio
     SET tiene_saldo_pendiente = 0, saldo_pendiente = 0.00, monto_total_asignado = ISNULL(monto_final, monto)
     WHERE tiene_saldo_pendiente IS NULL OR monto_total_asignado IS NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fam_solicitud_tiene_saldo' AND object_id = OBJECT_ID('fam_solicitud_beneficio'))
     BEGIN
       CREATE INDEX IX_fam_solicitud_tiene_saldo ON fam_solicitud_beneficio(tiene_saldo_pendiente);
       PRINT 'Indice IX_fam_solicitud_tiene_saldo creado.';
     END`
  ];

  for (const q of queries) {
    await prisma.$executeRawUnsafe(q);
  }
  
  console.log('-> Migración de columnas completada con éxito.');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Error en migración:', err.message);
  process.exit(1);
});
