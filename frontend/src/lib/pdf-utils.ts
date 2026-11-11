import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface DocumentoParaUnir {
  titulo: string;
  base64: string;
  subtitulo?: string;
}

export interface MetadatosExpedientePdf {
  expedienteNumero?: string;
  colegiadoNombre?: string;
  colegiadoCip?: string;
  tipoBeneficio?: string;
  incluirCaratula?: boolean;
}

function encodeBase64(binaryStr: string): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binaryStr);
  }
  return Buffer.from(binaryStr, 'binary').toString('base64');
}

function decodeBase64(b64: string): string {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(b64);
  }
  return Buffer.from(b64, 'base64').toString('binary');
}

/**
 * Convierte un Uint8Array a un string base64 estándar sin desbordamiento de pila.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB por trozo para evitar Call Stack Overflow en archivos grandes
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return encodeBase64(binary);
}

/**
 * Convierte un string base64 a Uint8Array.
 */
export function base64ToUint8Array(base64Raw: string): Uint8Array {
  const base64 = base64Raw.includes(',') ? base64Raw.split(',')[1] : base64Raw;
  const binaryString = decodeBase64(base64.trim());
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Determina si un archivo es una imagen soportada.
 */
export function esArchivoImagen(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.toLowerCase().split('.').pop() || '';
  return ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext);
}

/**
 * Determina si un archivo es un documento PDF.
 */
export function esArchivoPdf(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Convierte una imagen a un documento PDF de alta calidad usando un canvas y pdf-lib.
 * Siempre emite un PDF válido (con cabecera %PDF) compatible con las validaciones del backend.
 */
export async function convertirImagenAPdf(file: File): Promise<{ base64: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          throw new Error('No se pudo obtener el contenido de la imagen');
        }

        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada'));
        img.onload = async () => {
          try {
            const naturalW = img.naturalWidth || img.width || 800;
            const naturalH = naturalHFix(img);

            // Dibujar en canvas con fondo blanco para asegurar máxima compatibilidad (fondos transparentes de PNG/WEBP)
            const canvas = document.createElement('canvas');
            canvas.width = naturalW;
            canvas.height = naturalH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('No se pudo inicializar el contexto de imagen 2D');
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, naturalW, naturalH);
            ctx.drawImage(img, 0, 0, naturalW, naturalH);

            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const jpegBytes = base64ToUint8Array(jpegDataUrl);

            // Crear el documento PDF con pdf-lib
            const pdfDoc = await PDFDocument.create();
            const embeddedJpg = await pdfDoc.embedJpg(jpegBytes);

            // Dimensiones estándar A4 (595.28 x 841.89 puntos)
            const isLandscape = embeddedJpg.width > embeddedJpg.height;
            const pageW = isLandscape ? 841.89 : 595.28;
            const pageH = isLandscape ? 595.28 : 841.89;

            const margin = 20; // 20pt de margen
            const maxW = pageW - margin * 2;
            const maxH = pageH - margin * 2;

            const scale = Math.min(maxW / embeddedJpg.width, maxH / embeddedJpg.height, 1);
            const drawW = embeddedJpg.width * scale;
            const drawH = embeddedJpg.height * scale;
            const posX = (pageW - drawW) / 2;
            const posY = (pageH - drawH) / 2;

            const page = pdfDoc.addPage([pageW, pageH]);
            page.drawImage(embeddedJpg, {
              x: posX,
              y: posY,
              width: drawW,
              height: drawH,
            });

            const pdfBytes = await pdfDoc.save();
            const base64 = uint8ArrayToBase64(pdfBytes);
            resolve({ base64, size: pdfBytes.byteLength });
          } catch (err) {
            reject(err);
          }
        };
        img.src = dataUrl;
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

function naturalHFix(img: HTMLImageElement): number {
  return img.naturalHeight || img.height || 600;
}

/**
 * Procesa un archivo subido: si es PDF lo lee directamente; si es imagen (JPG, PNG, WEBP),
 * lo convierte de forma transparente a PDF. Rechaza otros tipos no permitidos.
 */
export async function procesarArchivoDocumento(
  file: File,
  maxMb = 10,
): Promise<{ base64: string; size: number; esImagenConvertida: boolean }> {
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`El archivo excede el tamaño máximo permitido (${maxMb}MB). Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  if (esArchivoPdf(file)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Error al leer el archivo PDF'));
      reader.onload = (e) => {
        const full = (e.target?.result as string) || '';
        const base64 = full.includes(',') ? full.split(',')[1] : full;
        resolve({ base64, size: file.size, esImagenConvertida: false });
      };
      reader.readAsDataURL(file);
    });
  }

  if (esArchivoImagen(file)) {
    const { base64, size } = await convertirImagenAPdf(file);
    return { base64, size, esImagenConvertida: true };
  }

  throw new Error('Formato no permitido. Solo se aceptan archivos PDF o imágenes (JPG, PNG, WEBP).');
}

/**
 * Une múltiples documentos PDF en un único PDF consolidado y estructurado.
 * Opcionalmente incluye una carátula institucional formal del Colegio de Ingenieros del Perú.
 */
export async function unirDocumentosPdf(
  documentos: DocumentoParaUnir[],
  metadata?: MetadatosExpedientePdf,
): Promise<string> {
  const docsValidos = documentos.filter((d) => Boolean(d && d.base64 && d.base64.trim().length > 0));

  if (docsValidos.length === 0) {
    throw new Error('No hay documentos adjuntos para consolidar');
  }

  const mergedPdf = await PDFDocument.create();

  // Si se solicita carátula y hay metadatos, generamos la página de portada institucional
  if (metadata && (metadata.incluirCaratula ?? true)) {
    try {
      const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica);

      const coverPage = mergedPdf.addPage([595.28, 841.89]); // A4 Portrait
      const { width, height } = coverPage.getSize();

      // Franja superior institucional (#3258CA)
      coverPage.drawRectangle({
        x: 0,
        y: height - 120,
        width,
        height: 120,
        color: rgb(0.196, 0.345, 0.792), // #3258CA
      });

      coverPage.drawText('COLEGIO DE INGENIEROS DEL PERÚ', {
        x: 40,
        y: height - 55,
        size: 16,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      coverPage.drawText('CONSEJO DEPARTAMENTAL CUSCO • FONDO DE AYUDA MUTUA (FAM)', {
        x: 40,
        y: height - 78,
        size: 10,
        font: fontRegular,
        color: rgb(0.9, 0.94, 1),
      });

      coverPage.drawText('EXPEDIENTE CONSOLIDADO DE BENEFICIOS', {
        x: 40,
        y: height - 100,
        size: 12,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Recuadro con datos del expediente
      const boxY = height - 280;
      coverPage.drawRectangle({
        x: 40,
        y: boxY,
        width: width - 80,
        height: 130,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.85, 0.89, 0.96),
        borderWidth: 1,
      });

      let currentTextY = boxY + 105;
      const lineStep = 22;

      const datosExpediente = [
        { label: 'N° EXPEDIENTE:', val: metadata.expedienteNumero || 'EN TRÁMITE' },
        { label: 'COLEGIADO:', val: `${metadata.colegiadoNombre || 'NO ASIGNADO'}${metadata.colegiadoCip ? ` (CIP: ${metadata.colegiadoCip})` : ''}` },
        { label: 'TIPO DE BENEFICIO:', val: metadata.tipoBeneficio || 'BENEFICIO FAM' },
        { label: 'FECHA DE CONSOLIDACIÓN:', val: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
        { label: 'CANTIDAD DE DOCUMENTOS:', val: `${docsValidos.length} documento(s) adjunto(s)` },
      ];

      for (const item of datosExpediente) {
        coverPage.drawText(item.label, {
          x: 55,
          y: currentTextY,
          size: 9,
          font: fontBold,
          color: rgb(0.2, 0.25, 0.35),
        });
        coverPage.drawText(item.val, {
          x: 210,
          y: currentTextY,
          size: 9,
          font: fontRegular,
          color: rgb(0.1, 0.15, 0.25),
        });
        currentTextY -= lineStep;
      }

      // Índice de Documentos
      coverPage.drawText('ÍNDICE DE DOCUMENTACIÓN ADJUNTA', {
        x: 40,
        y: height - 315,
        size: 11,
        font: fontBold,
        color: rgb(0.12, 0.2, 0.4),
      });

      let docIndexY = height - 340;
      let docNum = 1;

      for (const d of docsValidos) {
        if (docIndexY < 80) break; // Límite de página
        coverPage.drawText(`${docNum}.`, {
          x: 45,
          y: docIndexY,
          size: 9,
          font: fontBold,
          color: rgb(0.196, 0.345, 0.792),
        });
        coverPage.drawText(d.titulo, {
          x: 65,
          y: docIndexY,
          size: 9,
          font: fontBold,
          color: rgb(0.15, 0.2, 0.3),
        });
        if (d.subtitulo) {
          coverPage.drawText(`- ${d.subtitulo}`, {
            x: 240,
            y: docIndexY,
            size: 8.5,
            font: fontRegular,
            color: rgb(0.4, 0.45, 0.55),
          });
        }
        docIndexY -= 20;
        docNum++;
      }

      // Pie de carátula
      coverPage.drawText('Documento generado por el Sistema de Gestión de Beneficios Colegiales CIP-CD Cusco', {
        x: 40,
        y: 40,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.65),
      });
    } catch (e) {
      // Si la carátula falla por alguna razón de fuentes, continuamos con los documentos
      console.warn('No se pudo generar carátula, anexando documentos directamente:', e);
    }
  }

  // Concatenar cada documento
  for (const doc of docsValidos) {
    try {
      const pdfBytes = base64ToUint8Array(doc.base64);
      // Validar cabecera PDF
      if (pdfBytes.length < 5 || pdfBytes[0] !== 0x25 || pdfBytes[1] !== 0x50 || pdfBytes[2] !== 0x44 || pdfBytes[3] !== 0x46) {
        console.warn(`El documento "${doc.titulo}" no contiene una cabecera PDF válida, se omitirá.`);
        continue;
      }

      const srcPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } catch (err) {
      console.error(`Error al procesar el documento "${doc.titulo}":`, err);
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error('No se pudo procesar ninguno de los documentos adjuntos');
  }

  const mergedBytes = await mergedPdf.save();
  return uint8ArrayToBase64(mergedBytes);
}

/**
 * Descarga directamente un PDF en base64 en el navegador del usuario.
 */
export function descargarPdfBlob(base64: string, nombreArchivo: string): void {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

