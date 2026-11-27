const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('-> Ejecutando migración 034_colegiado_seguridad_bloqueos...');
  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('colegiado_seguridad_bloqueos') AND type = 'U')
    BEGIN
        CREATE TABLE colegiado_seguridad_bloqueos (
            id                          NVARCHAR(36)     NOT NULL DEFAULT NEWID(),
            cip                         VARCHAR(50)      NOT NULL,
            dni                         VARCHAR(20)      NULL,
            intentos_fallidos           INT              NOT NULL DEFAULT 1,
            bloqueado_hasta             DATETIME2        NULL,
            ip_address                  VARCHAR(45)      NULL,
            motivo                      NVARCHAR(200)    NULL DEFAULT 'EXCESO_INTENTOS_PREGUNTAS',
            created_at                  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
            updated_at                  DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT PK_colegiado_seguridad_bloqueos PRIMARY KEY CLUSTERED (id)
        );

        CREATE INDEX IX_colegiado_seguridad_bloqueos_cip ON colegiado_seguridad_bloqueos(cip);
        CREATE INDEX IX_colegiado_seguridad_bloqueos_hasta ON colegiado_seguridad_bloqueos(bloqueado_hasta);

        PRINT 'Tabla colegiado_seguridad_bloqueos creada exitosamente';
    END
  `);
  console.log('-> Migración 034 completada exitosamente.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error en migración 034:', err);
  process.exit(1);
});
