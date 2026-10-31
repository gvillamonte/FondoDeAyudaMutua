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
