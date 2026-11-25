const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('-> Ejecutando migración de columnas...');
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'debe_cambiar_password')
      BEGIN
        ALTER TABLE usuarios ADD debe_cambiar_password BIT NOT NULL CONSTRAINT DF_usuarios_debe_cambiar_pass DEFAULT 0;
      END
    `);
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'reset_password_token')
      BEGIN
        ALTER TABLE usuarios ADD reset_password_token VARCHAR(255) NULL;
      END
    `);
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'reset_password_expires')
      BEGIN
        ALTER TABLE usuarios ADD reset_password_expires DATETIME2 NULL;
      END
    `);
  } catch (e) {
    console.warn('Nota en columnas:', e.message);
  }

  const hash123456 = await bcrypt.hash('123456', 10);
  const updatedBquispe = await prisma.usuario.updateMany({
    where: { username: 'bquispe' },
    data: {
      passwordHash: hash123456,
      debeCambiarPassword: true,
      activo: true,
    },
  });
  console.log('-> Usuario bquispe configurado con clave 123456 y debeCambiarPassword = true (afectados:', updatedBquispe.count, ')');

  await prisma.$disconnect();
}

main().catch(console.error);
