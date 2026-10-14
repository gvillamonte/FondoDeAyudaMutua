import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EsPdfBase64, ActualizarFamSolicitudDto } from './fam-solicitud.dto';

const PDF_BASE64 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
).toString('base64');

const args = { property: 'memorando', constraints: [], object: {}, targetName: 'dto' } as any;

const clavesDeError = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => Object.keys(e.constraints ?? {}));

describe('EsPdfBase64 (validador de documentos)', () => {
  const validador = new EsPdfBase64();

  it('acepta un PDF en base64', () => {
    expect(validador.validate(PDF_BASE64, args)).toBe(true);
  });

  it('acepta un data URI con prefijo (base64 tras la coma)', () => {
    expect(validador.validate(`data:application/pdf;base64,${PDF_BASE64}`, args)).toBe(true);
  });

  it('ignora valores vacios para que el PUT parcial no falle', () => {
    expect(validador.validate(undefined, args)).toBe(true);
    expect(validador.validate(null, args)).toBe(true);
    expect(validador.validate('', args)).toBe(true);
  });

  it('rechaza contenido que no es PDF', () => {
    expect(validador.validate(Buffer.from('hola mundo').toString('base64'), args)).toBe(false);
  });

  it('rechaza tipos que no son string', () => {
    expect(validador.validate(12345 as any, args)).toBe(false);
    expect(validador.validate({} as any, args)).toBe(false);
  });

  it('rechaza documentos que exceden el maximo de ~10MB', () => {
    const casiLimite = `JVBERi${'A'.repeat(14_000_001 - 6)}`;
    expect(casiLimite.length).toBe(14_000_001);
    expect(validador.validate(casiLimite, args)).toBe(false);
  });

  it('permite exactamente el maximo admitido', () => {
    const enLimite = `JVBERi${'A'.repeat(14_000_000 - 6)}`;
    expect(enLimite.length).toBe(14_000_000);
    expect(validador.validate(enLimite, args)).toBe(true);
  });

  it('describe el error en espanol', () => {
    expect(validador.defaultMessage(args)).toContain('base64');
  });
});

describe('ActualizarFamSolicitudDto', () => {
  const validar = (payload: Record<string, unknown>) =>
    validate(plainToInstance(ActualizarFamSolicitudDto, payload));

  it('acepta la subida de un solo documento (PUT parcial)', async () => {
    expect(await validar({ memorando: PDF_BASE64 })).toHaveLength(0);
  });

  it('acepta los seis campos de documento', async () => {
    expect(
      await validar({
        fichaAdmisibilidad: PDF_BASE64,
        solicitudAsignacion: PDF_BASE64,
        cartaRemision: PDF_BASE64,
        memorando: PDF_BASE64,
        ordenPago: PDF_BASE64,
        sucesionIntestada: PDF_BASE64,
      }),
    ).toHaveLength(0);
  });

  it('acepta un payload sin documentos (solo metadatos)', async () => {
    expect(await validar({ monto: 1500, estado: 'PAGADA' })).toHaveLength(0);
  });

  it('acepta un payload totalmente vacio (nada se borra)', async () => {
    expect(await validar({})).toHaveLength(0);
  });

  it('rechaza un documento que no es PDF', async () => {
    const errores = await validar({ memorando: 'no-es-un-pdf' });
    expect(clavesDeError(errores)).toContain('pdfBase64');
  });

  it('rechaza un documento con contenido binario no PDF', async () => {
    const errores = await validar({ ordenPago: Buffer.from('JVBORi0x').toString('base64') });
    expect(clavesDeError(errores)).toContain('pdfBase64');
  });

  it('rechaza monto negativo', async () => {
    const errores = await validar({ monto: -1 });
    expect(clavesDeError(errores)).toContain('min');
  });

  it('rechaza documentacionCompleta que no es booleano', async () => {
    const errores = await validar({ documentacionCompleta: 'SI' });
    expect(clavesDeError(errores)).toContain('isBoolean');
  });
});
