import { jsPDF } from 'jspdf';

export interface DatosColegiadoPdf {
  NUM_COLEGIATURA: string;
  NOMBRE_COLEGIADO: string;
  DNI: string;
}

export interface DatosHerederoPdf {
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
  porcentaje: number;
  monto: number;
  telefono?: string;
  email?: string;
}

export interface GenerarDeclaracionParams {
  heredero: DatosHerederoPdf;
  colegiado: DatosColegiadoPdf;
  montoTotal: number;
  partidaRegistral?: string;
  notariaJuzgado?: string;
}

export interface GenerarVoucherParams {
  heredero: DatosHerederoPdf;
  colegiado: DatosColegiadoPdf;
  expedienteNumero?: string;
  fecha?: string;
  concepto?: string;
}

/**
 * Convierte un número a palabras simples en español para montos (PEN)
 */
function numeroALetras(monto: number): string {
  const entero = Math.floor(monto);
  const decimales = Math.round((monto - entero) * 100);
  const centavosStr = `${decimales.toString().padStart(2, '0')}/100 SOLES`;

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales: Record<number, string> = {
    11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    21: 'VEINTIÚN', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
    25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
  };
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (entero === 0) return `CERO CON ${centavosStr}`;
  if (entero === 100) return `CIEN CON ${centavosStr}`;

  let letras = '';
  const miles = Math.floor(entero / 1000);
  const resto = entero % 1000;

  if (miles === 1) letras += 'MIL ';
  else if (miles > 1) {
    if (miles < 10) letras += `${unidades[miles]} MIL `;
    else letras += `${miles} MIL `;
  }

  if (resto > 0) {
    const c = Math.floor(resto / 100);
    const d = Math.floor((resto % 100) / 10);
    const u = resto % 10;
    const du = resto % 100;

    if (c > 0) {
      if (resto === 100) letras += 'CIEN ';
      else letras += `${centenas[c]} `;
    }

    if (especiales[du]) {
      letras += `${especiales[du]} `;
    } else {
      if (d > 0) {
        letras += `${decenas[d]} `;
        if (u > 0) letras += `Y ${unidades[u]} `;
      } else if (u > 0) {
        letras += `${unidades[u]} `;
      }
    }
  }

  return `${letras.trim()} CON ${centavosStr}`.toUpperCase();
}

/**
 * Genera la Declaración Jurada oficial en PDF institucional para un heredero
 */
export function generarDeclaracionJuradaPdf({
  heredero,
  colegiado,
  montoTotal,
  partidaRegistral,
  notariaJuzgado,
}: GenerarDeclaracionParams): { base64: string; size: number } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nombreHeredero = `${heredero.nombres.trim()} ${heredero.apellidos.trim()}`.toUpperCase();
  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Franja superior institucional
  doc.setFillColor(50, 88, 202); // #3258CA
  doc.rect(0, 0, 210, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COLEGIO DE INGENIEROS DEL PERÚ', 105, 10, { align: 'center' });

  // Encabezado del documento
  doc.setTextColor(30, 41, 59); // #1E293B
  doc.setFontSize(13);
  doc.text('FONDO DE ASISTENCIA MUTUA (FAM)', 105, 26, { align: 'center' });
  doc.setFontSize(12);
  doc.text('DECLARACIÓN JURADA DE BENEFICIARIO - SUCESIÓN INTESTADA', 105, 33, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.line(20, 37, 190, 37);

  // Cuerpo legal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  let y = 47;
  const textoIdentificacion =
    `Yo, ${nombreHeredero}, identificado(a) con ${heredero.tipoDocumento} Nº ${heredero.numeroDocumento}, ` +
    `en calidad de ${heredero.parentesco.toUpperCase()} del extinto(a) colegiado(a) ${colegiado.NOMBRE_COLEGIADO.toUpperCase()}, ` +
    `con CIP Nº ${colegiado.NUM_COLEGIATURA} y DNI Nº ${colegiado.DNI}, domiciliado(a) para estos efectos con datos de contacto: ` +
    `Teléfono: ${heredero.telefono || 'No registrado'} / Correo: ${heredero.email || 'No registrado'};`;

  const lineasId = doc.splitTextToSize(textoIdentificacion, 170);
  doc.text(lineasId, 20, y);
  y += lineasId.length * 6 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('DECLARO BAJO JURAMENTO:', 20, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  const declaraciones = [
    `1. Que he sido formalmente reconocido(a) como heredero(a) legal del citado colegiado, de conformidad con el procedimiento de Sucesión Intestada tramitado${partidaRegistral ? ` e inscrito en la Partida Registral Nº ${partidaRegistral}` : ''}${notariaJuzgado ? ` ante ${notariaJuzgado}` : ''}, cuyo documento de sustento obra debidamente adjuntado en el expediente institucional.`,
    `2. Que de acuerdo con la declaratoria de herederos y el reparto legalmente conferido, me corresponde el ${heredero.porcentaje.toFixed(2)}% del beneficio del Fondo de Asistencia Mutua (FAM) por concepto de Fallecimiento, equivalente al importe de S/ ${heredero.monto.toFixed(2)} (${numeroALetras(heredero.monto)}) de un monto total a liquidar de S/ ${montoTotal.toFixed(2)}.`,
    `3. Que me comprometo a destinar y percibir los fondos correspondientes sin perjuicio de los derechos que legalmente asistan a los demás coherederos declarados en el presente trámite.`,
    `4. Que afirmo la veracidad de la información y documentación aportada, sometiéndome a las responsabilidades civiles y penales correspondientes en caso de falsedad, conforme al Art. 411 del Código Penal y la Ley del Procedimiento Administrativo General.`
  ];

  for (const item of declaraciones) {
    const lineas = doc.splitTextToSize(item, 170);
    doc.text(lineas, 20, y);
    y += lineas.length * 5.2 + 3.5;
  }

  y += 4;
  doc.text(`En señal de conformidad con lo declarado, suscribo el presente documento en la ciudad respectiva, a los ${fechaHoy}.`, 20, y);

  // Cuadro de firma
  y = Math.max(y + 25, 220);
  doc.setDrawColor(100, 116, 139);
  doc.line(70, y, 140, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FIRMA DEL DECLARANTE', 105, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(nombreHeredero, 105, y + 10, { align: 'center' });
  doc.text(`${heredero.tipoDocumento}: ${heredero.numeroDocumento}`, 105, y + 14, { align: 'center' });
  doc.text(`Porcentaje asignado: ${heredero.porcentaje.toFixed(2)}% (S/ ${heredero.monto.toFixed(2)})`, 105, y + 18, { align: 'center' });

  // Pie de página institucional
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento oficial generado por el Sistema de Gestión de Beneficios Colegiales - CIP', 105, 287, { align: 'center' });

  const outputData = doc.output('datauristring');
  const base64 = outputData.split(',')[1] || '';
  const size = Math.round((base64.length * 3) / 4);

  return { base64, size };
}

/**
 * Genera el Voucher / Orden de Pago individual en PDF institucional para un heredero
 */
export function generarVoucherOrdenPagoPdf({
  heredero,
  colegiado,
  expedienteNumero,
  fecha,
  concepto,
}: GenerarVoucherParams): { base64: string; size: number } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nombreHeredero = `${heredero.nombres.trim()} ${heredero.apellidos.trim()}`.toUpperCase();
  const fechaEmision = fecha || new Date().toLocaleDateString('es-PE');

  // Franja superior
  doc.setFillColor(50, 88, 202); // #3258CA
  doc.rect(0, 0, 210, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COLEGIO DE INGENIEROS DEL PERÚ', 105, 10, { align: 'center' });

  // Título Voucher
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.text('ORDEN DE PAGO / VOUCHER DE BENEFICIO FAM', 105, 26, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`EXPEDIENTE Nº ${expedienteNumero || 'S/N'} — SUCESIÓN INTESTADA`, 105, 32, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.line(20, 36, 190, 36);

  // Recuadro Resumen del Monto
  doc.setFillColor(248, 250, 252); // Gris claro #F8FAFC
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(20, 41, 170, 28, 3, 3, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('IMPORTE NETO A PAGAR:', 28, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(22, 163, 74); // Verde éxito #16A34A
  doc.text(`S/ ${heredero.monto.toFixed(2)}`, 28, 58);

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`SON: ${numeroALetras(heredero.monto)}`, 28, 64);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 88, 202);
  doc.text(`CUOTA: ${heredero.porcentaje.toFixed(2)}%`, 150, 58, { align: 'right' });

  // Tabla informativa de datos
  let y = 78;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const agregarFila = (etiqueta: string, valor: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(etiqueta, 22, y);
    doc.setFont('helvetica', 'normal');
    doc.text(valor, 75, y);
    y += 7.5;
  };

  agregarFila('Concepto:', concepto || 'Beneficio por Fallecimiento FAM (Sucesión Intestada)');
  agregarFila('Colegiado Causante:', colegiado.NOMBRE_COLEGIADO.toUpperCase());
  agregarFila('CIP / DNI Colegiado:', `CIP ${colegiado.NUM_COLEGIATURA} — DNI ${colegiado.DNI}`);
  agregarFila('Beneficiario Heredero:', nombreHeredero);
  agregarFila('Documento de Identidad:', `${heredero.tipoDocumento} Nº ${heredero.numeroDocumento}`);
  agregarFila('Parentesco Legal:', heredero.parentesco);
  agregarFila('Teléfono / Contacto:', heredero.telefono || 'No especificado');
  agregarFila('Correo Electrónico:', heredero.email || 'No especificado');
  agregarFila('Fecha de Emisión:', fechaEmision);

  // Recuadro de Aprobación y Tesorería
  y += 15;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, y, 170, 45, 2, 2);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CONTROL DE TESORERÍA Y CONFORMIDAD', 105, y + 6, { align: 'center' });

  doc.line(30, y + 33, 85, y + 33);
  doc.line(125, y + 33, 180, y + 33);

  doc.text('Vo.Bo. Tesorería CIP', 57, y + 38, { align: 'center' });
  doc.text('Firma y DNI del Beneficiario', 152, y + 38, { align: 'center' });

  // Pie de página institucional
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Este voucher es comprobante oficial de asignación de fondos del programa FAM.', 105, 287, { align: 'center' });

  const outputData = doc.output('datauristring');
  const base64 = outputData.split(',')[1] || '';
  const size = Math.round((base64.length * 3) / 4);

  return { base64, size };
}
