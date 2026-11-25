const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const newHash = await bcrypt.hash('Admin123!', 10);
  const updated = await prisma.usuario.update({
    where: { username: 'bquispe' },
    data: {
      passwordHash: newHash,
      activo: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      nombreCompleto: true,
      rol: true,
      activo: true,
    }
  });
  console.log('USUARIO BQUISPE ACTUALIZADO CON ÉXITO:');
  console.log(JSON.stringify(updated, null, 2));
  console.log('Contraseña establecida: Admin123!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
