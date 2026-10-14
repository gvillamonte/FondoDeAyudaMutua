const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.famSolicitudBeneficio.deleteMany();
  const b = await p.famBeneficiario.deleteMany();
  console.log('Limpieza: ' + b.count + ' beneficiarios eliminados');
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
