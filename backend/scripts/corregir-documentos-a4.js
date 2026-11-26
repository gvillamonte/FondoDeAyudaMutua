const { PrismaClient } = require('@prisma/client');
const { PDFDocument } = require('pdf-lib');
const prisma = new PrismaClient();

const CAMPOS = [
  'fichaAdmisibilidad',
  'solicitudAsignacion',
  'cartaRemision',
  'memorando',
  'ordenPago',
  'sucesionIntestada',
  'declaracionJurada'
];

async function corregirPdfA4(base64Str) {
  try {
    const rawBytes = Buffer.from(base64Str, 'base64');
    if (rawBytes[0] !== 0x25 || rawBytes[1] !== 0x50 || rawBytes[2] !== 0x44 || rawBytes[3] !== 0x46) {
      return null;
    }
    const doc = await PDFDocument.load(rawBytes);
    if (doc.getPageCount() !== 1) return null;

    let imgBytes = null;
    let isJpg = false;
    let isPng = false;

    for (const [, obj] of doc.context.indirectObjects.entries()) {
      const dictStr = obj?.dict?.toString?.() || '';
      if (dictStr.includes('/Subtype /Image') && obj.contents && obj.contents.length > 500) {
        const bytes = new Uint8Array(obj.contents);
        if (bytes[0] === 0xff && bytes[1] === 0xd8) {
          imgBytes = bytes;
          isJpg = true;
          break;
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
          imgBytes = bytes;
          isPng = true;
          break;
        }
      }
    }

    if (!imgBytes) return null;

    const newDoc = await PDFDocument.create();
    const embedded = isJpg ? await newDoc.embedJpg(imgBytes) : await newDoc.embedPng(imgBytes);

    // Si la imagen original ya llena la hoja (ancho >= 550 y alto >= 780), no requiere cambios
    if (embedded.width >= 550 && embedded.height >= 780) {
      return null;
    }

    const isLandscape = embedded.width > embedded.height;
    const pageW = isLandscape ? 841.89 : 595.28;
    const pageH = isLandscape ? 595.28 : 841.89;

    const margin = 10;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;
    const posX = (pageW - drawW) / 2;
    const posY = (pageH - drawH) / 2;

    const page = newDoc.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: posX, y: posY, width: drawW, height: drawH });

    const newPdfBytes = await newDoc.save();
    return Buffer.from(newPdfBytes).toString('base64');
  } catch {
    return null;
  }
}

async function main() {
  console.log('Iniciando escaneo de documentos para ajuste a formato A4...');
  const exps = await prisma.famSolicitudBeneficio.findMany();
  let corregidos = 0;

  for (const exp of exps) {
    const dataUpdate = {};
    for (const c of CAMPOS) {
      if (exp[c]) {
        const nuevoB64 = await corregirPdfA4(exp[c]);
        if (nuevoB64) {
          dataUpdate[c] = nuevoB64;
          corregidos++;
          console.log(`[Ajustado a A4] Exp #${exp.expedienteNumero} -> ${c}`);
        }
      }
    }
    if (Object.keys(dataUpdate).length > 0) {
      await prisma.famSolicitudBeneficio.update({
        where: { id: exp.id },
        data: dataUpdate
      });
    }
  }

  console.log(`\nProceso finalizado. Total de documentos escalados a A4 completo: ${corregidos}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
