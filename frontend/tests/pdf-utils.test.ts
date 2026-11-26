import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  esArchivoImagen,
  esArchivoPdf,
  unirDocumentosPdf,
  asegurarDocumentoA4Pdf,
  DocumentoParaUnir,
} from '../src/lib/pdf-utils';

describe('pdf-utils', () => {
  it('detecta correctamente tipos de archivo PDF e imagen', () => {
    expect(esArchivoPdf({ name: 'solicitud.pdf', type: 'application/pdf' } as File)).toBe(true);
    expect(esArchivoPdf({ name: 'solicitud.PDF', type: '' } as File)).toBe(true);
    expect(esArchivoPdf({ name: 'foto.jpg', type: 'image/jpeg' } as File)).toBe(false);

    expect(esArchivoImagen({ name: 'foto.jpg', type: 'image/jpeg' } as File)).toBe(true);
    expect(esArchivoImagen({ name: 'scan.png', type: 'image/png' } as File)).toBe(true);
    expect(esArchivoImagen({ name: 'dni.webp', type: 'image/webp' } as File)).toBe(true);
    expect(esArchivoImagen({ name: 'documento.pdf', type: 'application/pdf' } as File)).toBe(false);
  });

  it('codifica y decodifica Uint8Array a base64 correctamente', () => {
    const raw = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = uint8ArrayToBase64(raw);
    expect(b64).toBe('SGVsbG8=');
    const decoded = base64ToUint8Array(b64);
    expect(Array.from(decoded)).toEqual([72, 101, 108, 108, 111]);
  });

  it('une múltiples documentos PDF en un solo PDF consolidado', async () => {
    // Crear dos documentos PDF de prueba
    const pdf1 = await PDFDocument.create();
    pdf1.addPage([200, 200]);
    const pdfBytes1 = await pdf1.save();
    const b64Doc1 = uint8ArrayToBase64(pdfBytes1);

    const pdf2 = await PDFDocument.create();
    pdf2.addPage([300, 300]);
    pdf2.addPage([300, 300]);
    const pdfBytes2 = await pdf2.save();
    const b64Doc2 = uint8ArrayToBase64(pdfBytes2);

    const docs: DocumentoParaUnir[] = [
      { titulo: 'Ficha de Admisibilidad', base64: b64Doc1 },
      { titulo: 'Solicitud de Beneficio', base64: b64Doc2 },
    ];

    const mergedBase64 = await unirDocumentosPdf(docs, {
      expedienteNumero: 'EXP-TEST-001',
      colegiadoNombre: 'ING. JUAN PEREZ',
      colegiadoCip: '12345',
      tipoBeneficio: 'FALLECIMIENTO',
      incluirCaratula: true,
    });

    expect(mergedBase64).toBeTruthy();
    expect(mergedBase64.startsWith('JVBERi')).toBe(true);

    // Verificar que el PDF resultante contiene la carátula (1 página) + 1 página de pdf1 + 2 páginas de pdf2 = 4 páginas
    const mergedDoc = await PDFDocument.load(base64ToUint8Array(mergedBase64));
    expect(mergedDoc.getPageCount()).toBe(4);
  });

  it('asegura que documentos e imágenes se expandan a formato A4 estándar', async () => {
    // 1. Imagen PNG mínima (1x1 pixel)
    const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const a4Pdf = await asegurarDocumentoA4Pdf(png1x1);
    expect(a4Pdf.startsWith('JVBERi')).toBe(true);

    const doc = await PDFDocument.load(base64ToUint8Array(a4Pdf));
    const page = doc.getPages()[0];
    const { width, height } = page.getSize();
    // Dimensiones A4 estándar en puntos
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

