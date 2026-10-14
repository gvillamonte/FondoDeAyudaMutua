const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ex = await p.famSolicitudBeneficio.deleteMany();
  const bn = await p.famBeneficiario.deleteMany();
  console.log('Limpieza final: ' + ex.count + ' expedientes, ' + bn.count + ' beneficiarios');
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
