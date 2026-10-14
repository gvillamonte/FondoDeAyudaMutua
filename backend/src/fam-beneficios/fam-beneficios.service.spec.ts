import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FamBeneficiosService } from './fam-beneficios.service';

const PDF_BASE64 = Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF\n').toString('base64');

const DOCUMENTOS = [
  'fichaAdmisibilidad',
  'solicitudAsignacion',
  'cartaRemision',
  'memorando',
  'ordenPago',
  'sucesionIntestada',
] as const;

const crearPrismaMock = () => ({
  famSolicitudBeneficio: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  tipoBeneficio: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  tipoBeneficioConfig: { findUnique: jest.fn() },
  famCovidAsignacion: { findMany: jest.fn() },
});

const auditService = { log: jest.fn() } as any;
const famService = {} as any;

const solicitudExistente = {
  id: 'exp-1',
  colegiadoId: 'C-7148',
  tipoBeneficioId: 'TB-FAM-001',
  monto: 3000,
  descuentoCovid: 0,
};

const montarService = (prisma: ReturnType<typeof crearPrismaMock>) => {
  prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(solicitudExistente);
  prisma.tipoBeneficio.findUnique.mockResolvedValue({ id: 'TB-FAM-001', codigo: 'FALLECIMIENTO' });
  prisma.famSolicitudBeneficio.update.mockResolvedValue(solicitudExistente);
  return new FamBeneficiosService(prisma as any, auditService, famService);
};

const datosDeUpdate = (prisma: ReturnType<typeof crearPrismaMock>) =>
  prisma.famSolicitudBeneficio.update.mock.calls[0][0].data as Record<string, unknown>;

describe('FamBeneficiosService.actualizar - subida de documentos', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
  });

  it('subir un documento no borra los demas documentos ni los metadatos', async () => {
    await service.actualizar('exp-1', { memorando: PDF_BASE64 } as any, 'ADMINISTRADOR');

    const data = datosDeUpdate(prisma);
    expect(data.memorando).toBe(PDF_BASE64);

    for (const campo of DOCUMENTOS) {
      if (campo === 'memorando') continue;
      expect(data).not.toHaveProperty(campo);
    }
    expect(data).not.toHaveProperty('documentacionCompleta');
    expect(data).not.toHaveProperty('monto');
    expect(data).not.toHaveProperty('estado');
    expect(data).not.toHaveProperty('expedienteNumero');
    expect(prisma.famSolicitudBeneficio.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'exp-1' } }),
    );
  });

  it('solo los campos enviados llegan al UPDATE (PUT parcial)', async () => {
    await service.actualizar('exp-1', { fichaAdmisibilidad: PDF_BASE64 } as any, 'ADMINISTRADOR');

    const data = datosDeUpdate(prisma);
    expect(data).toEqual({ fichaAdmisibilidad: PDF_BASE64 });
  });

  it('acepta un payload vacio sin modificar nada', async () => {
    await service.actualizar('exp-1', {} as any, 'ADMINISTRADOR');
    expect(datosDeUpdate(prisma)).toEqual({});
  });

  it('puede marcar documentacionCompleta=true al completar los documentos', async () => {
    await service.actualizar(
      'exp-1',
      { documentacionCompleta: true } as any,
      'ADMINISTRADOR',
    );
    expect(datosDeUpdate(prisma).documentacionCompleta).toBe(true);
  });

  it('rechaza documentacionCompleta=false sin justificacion', async () => {
    await expect(
      service.actualizar('exp-1', { documentacionCompleta: false } as any, 'ADMINISTRADOR'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
  });

  it('acepta documentacionCompleta=false cuando hay observacion', async () => {
    await service.actualizar(
      'exp-1',
      { documentacionCompleta: false, documentacionObservacion: 'Falta orden de pago' } as any,
      'ADMINISTRADOR',
    );
    expect(datosDeUpdate(prisma).documentacionCompleta).toBe(false);
  });

  it('devuelve 404 si el expediente no existe', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(null);
    await expect(
      service.actualizar('inexistente', { memorando: PDF_BASE64 } as any, 'ADMINISTRADOR'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
  });

  it('no permite cambiar tipo sin resolver la configuracion', async () => {
    prisma.tipoBeneficioConfig.findUnique.mockResolvedValue(null);
    await service.actualizar(
      'exp-1',
      { tipoBeneficioConfigId: 999 } as any,
      'ADMINISTRADOR',
    );
    expect(datosDeUpdate(prisma)).not.toHaveProperty('tipoBeneficio');
  });
});

describe('FamBeneficiosService - bloqueo por Fallecimiento activo', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
  });

  const consultaFallecimiento = () => prisma.famSolicitudBeneficio.count.mock.calls[0][0].where;

  it('tieneFallecimientoActivo consulta solo FALLECIMIENTO no rechazada', async () => {
    prisma.famSolicitudBeneficio.count.mockResolvedValue(1);

    await expect(
      (service as any).tieneFallecimientoActivo('C-7148'),
    ).resolves.toBe(true);

    expect(consultaFallecimiento()).toEqual({
      colegiadoId: 'C-7148',
      estado: { not: 'RECHAZADA' },
      tipoBeneficio: { codigo: 'FALLECIMIENTO' },
    });
  });

  it('tieneFallecimientoActivo devuelve false sin fallecimientos activos', async () => {
    prisma.famSolicitudBeneficio.count.mockResolvedValue(0);
    await expect((service as any).tieneFallecimientoActivo('C-0')).resolves.toBe(false);
  });

  it('tieneFallecimientoActivo no bloquea si la consulta falla', async () => {
    prisma.famSolicitudBeneficio.count.mockRejectedValue(new Error('db down'));
    await expect((service as any).tieneFallecimientoActivo('C-0')).resolves.toBe(false);
  });

  it('crearRegistro devuelve 409 si ya hay un fallecimiento activo', async () => {
    prisma.famSolicitudBeneficio.count.mockResolvedValue(1);

    await expect(
      service.crearRegistro(
        {
          colegiadoId: 'C-7148',
          documentacionCompleta: true,
          beneficiarios: [{ id: 'B1', nombre: 'Beneficiario', porcentaje: 100 }],
          solicitanteIndice: 0,
        } as any,
        'u-1',
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('crear devuelve 409 si ya hay un fallecimiento activo', async () => {
    prisma.famSolicitudBeneficio.count.mockResolvedValue(1);

    await expect(
      service.crear(
        { colegiadoId: 'C-7148', tipoBeneficioId: 'TB-FAM-002', monto: 500 } as any,
        'u-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('crear registra el expediente cuando NO hay fallecimiento activo', async () => {
    prisma.famSolicitudBeneficio.count.mockResolvedValue(0);
    prisma.famSolicitudBeneficio.create.mockResolvedValue({ id: 'exp-nuevo' });

    const resultado = await service.crear(
      { colegiadoId: 'C-7148', tipoBeneficioId: 'TB-FAM-002', monto: 500 } as any,
      'u-1',
    );

    expect(resultado).toEqual({ id: 'exp-nuevo' });
    expect(prisma.famSolicitudBeneficio.create).toHaveBeenCalled();
  });

  it('crearRegistro no bloquea cuando NO hay fallecimiento activo', async () => {
    prisma.famSolicitudBeneficio.count.mockResolvedValue(0);

    const err = await service
      .crearRegistro(
        {
          colegiadoId: 'C-7148',
          documentacionCompleta: true,
          beneficiarios: [{ id: 'B1', nombre: 'Beneficiario', porcentaje: 100 }],
          solicitanteIndice: 0,
        } as any,
        'u-1',
        '127.0.0.1',
      )
      .catch((e: unknown) => e);

    expect(err).not.toBeInstanceOf(ConflictException);
    expect(prisma.famSolicitudBeneficio.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoBeneficio: { codigo: 'FALLECIMIENTO' } }),
      }),
    );
  });
});
