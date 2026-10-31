import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  famSolicitudBeneficiario: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  famDepositoBeneficiario: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  famBeneficiario: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  montoFam: { findFirst: jest.fn() },
  tipoBeneficio: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  tipoBeneficioConfig: { findUnique: jest.fn() },
  famCovidAsignacion: { findMany: jest.fn(), findFirst: jest.fn() },
  auditLog: { findMany: jest.fn() },
  usuario: { findMany: jest.fn() },
});

const crearTransaccionMock = (prisma: any) => {
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};

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
  if (!(prisma as any).$transaction) crearTransaccionMock(prisma);
  prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(solicitudExistente);
  prisma.tipoBeneficio.findUnique.mockResolvedValue({ id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' });
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

describe('FamBeneficiosService - expediente unico y reparto por beneficiario', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
  });

  const expedienteActivo = (overrides: Record<string, any> = {}) => ({
    id: 'exp-activo',
    colegiadoId: 'C-7148',
    estado: 'PENDIENTE',
    tipoBeneficioId: 'TB-FAM-001',
    monto: 3000,
    montoFinal: null,
    sucesionIntestada: null,
    solicitanteNombre: null,
    solicitanteDni: null,
    banco: null,
    fechaPago: null,
    tipoBeneficio: { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
    vinculos: [
      {
        beneficiarioId: 'B1',
        porcentajeAsignado: 50,
        declaracionJurada: PDF_BASE64,
        declaracionJuradaDni: '12345678',
        beneficiario: { id: 'B1', nombre: 'Ana', dni: '11111111' },
      },
    ],
    depositos: [],
    ...overrides,
  });

  const dtoRegistro = (extra: Record<string, any> = {}) => ({
    colegiadoId: 'C-7148',
    documentacionCompleta: true,
    tipoBeneficioConfigId: 1,
    monto: 3000,
    modalidadBeneficio: 'monto_compartido',
    beneficiarios: [{ id: 'B1', nombre: 'Ana', parentesco: 'Hija', porcentaje: 50 }],
    solicitanteIndice: 0,
    ...extra,
  });

  it('bloquea un segundo expediente del mismo tipo y devuelve el expediente activo', async () => {
    prisma.tipoBeneficioConfig.findUnique.mockResolvedValue({ id: 1, nombre: 'Fallecimiento' });
    prisma.tipoBeneficio.findMany.mockResolvedValue([
      { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
    ]);
    prisma.famSolicitudBeneficio.findFirst.mockResolvedValue(expedienteActivo());

    const err: any = await service
      .crearRegistro(dtoRegistro() as any, 'u-1', '127.0.0.1')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({
      solicitudId: 'exp-activo',
      porcentajeAsignado: 50,
      completo: false,
    });
    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('bloquea el registro de otros beneficios si el colegiado se encuentra fallecido', async () => {
    prisma.tipoBeneficioConfig.findUnique.mockResolvedValue({ id: 2, nombre: 'COVID-19' });
    prisma.tipoBeneficio.findMany.mockResolvedValue([
      { id: 'TB-FAM-COVID', codigo: 'COVID_19', nombre: 'COVID-19' },
    ]);
    prisma.famSolicitudBeneficio.findFirst.mockResolvedValue({
      id: 'exp-fallecimiento',
      estado: 'PAGADA',
      tipoBeneficio: { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
    });

    await expect(
      service.crearRegistro(
        dtoRegistro({
          tipoBeneficioConfigId: 2,
          beneficiarios: [{ nombre: 'Ana', parentesco: 'Hija', porcentaje: 100 }],
        }) as any,
        'u-1',
        '127.0.0.1',
      ),
    ).rejects.toThrow('No se pueden registrar más beneficios porque el colegiado está fallecido.');

    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('crear simple bloquea el beneficio si existe un fallecimiento previo', async () => {
    prisma.tipoBeneficio.findUnique.mockResolvedValue({
      id: 'TB-FAM-COVID',
      codigo: 'COVID_19',
      nombre: 'COVID-19',
    });
    prisma.famSolicitudBeneficio.findFirst.mockResolvedValue({
      id: 'exp-fallecimiento',
      estado: 'PAGADA',
      tipoBeneficio: { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
    });

    await expect(
      service.crear(
        { colegiadoId: 'C-7148', tipoBeneficioId: 'TB-FAM-COVID', monto: 2000 } as any,
        'u-1',
      ),
    ).rejects.toThrow('No se pueden registrar más beneficios porque el colegiado está fallecido.');

    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('crear simple bloquea un segundo expediente del mismo tipo', async () => {
    prisma.famSolicitudBeneficio.findFirst.mockResolvedValue(expedienteActivo());

    await expect(
      service.crear(
        { colegiadoId: 'C-7148', tipoBeneficioId: 'TB-FAM-001', monto: 3000 } as any,
        'u-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('no permite pagar si los porcentajes no suman 100%', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(expedienteActivo());

    await expect(service.pagar('exp-activo', {}, 'u-1', '127.0.0.1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.famDepositoBeneficiario.create).not.toHaveBeenCalled();
  });

  it('no permite pagar si falta la declaracion jurada de un beneficiario', async () => {
    const existente = expedienteActivo({
      vinculos: [
        {
          beneficiarioId: 'B1',
          porcentajeAsignado: 50,
          declaracionJurada: PDF_BASE64,
          declaracionJuradaDni: '12345678',
          beneficiario: { id: 'B1', nombre: 'Ana', dni: '11111111' },
        },
        {
          beneficiarioId: 'B2',
          porcentajeAsignado: 50,
          declaracionJurada: null,
          declaracionJuradaDni: null,
          beneficiario: { id: 'B2', nombre: 'Luis', dni: '22222222' },
        },
      ],
    });
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(existente);

    const err: any = await service.pagar('exp-activo', {}, 'u-1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toContain('Luis');
    expect(prisma.famDepositoBeneficiario.create).not.toHaveBeenCalled();
  });

  it('genera un deposito por beneficiario con la misma fecha y montos por porcentaje', async () => {
    const existente = expedienteActivo({
      vinculos: [
        {
          beneficiarioId: 'B1',
          porcentajeAsignado: 50,
          declaracionJurada: PDF_BASE64,
          declaracionJuradaDni: '12345678',
          beneficiario: { id: 'B1', nombre: 'Ana', dni: '11111111' },
        },
        {
          beneficiarioId: 'B2',
          porcentajeAsignado: 50,
          declaracionJurada: PDF_BASE64,
          declaracionJuradaDni: '87654321',
          beneficiario: { id: 'B2', nombre: 'Luis', dni: '22222222' },
        },
      ],
    });
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(existente);
    prisma.famSolicitudBeneficio.update.mockResolvedValue({});
    prisma.famDepositoBeneficiario.create.mockResolvedValue({});
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({ id: 'exp-activo' } as any);

    await service.pagar(
      'exp-activo',
      {
        fechaPago: '2026-10-22',
        depositos: [
          { beneficiarioId: 'B1', banco: 'BCP', numeroCuenta: '111' },
          { beneficiarioId: 'B2', banco: 'Interbank', numeroCuenta: '222' },
        ],
      },
      'u-1',
      '127.0.0.1',
    );

    const depositos = prisma.famDepositoBeneficiario.create.mock.calls.map((c) => c[0].data);
    expect(depositos).toHaveLength(2);
    expect(depositos[0]).toMatchObject({ beneficiarioId: 'B1', monto: 1500, banco: 'BCP' });
    expect(depositos[1]).toMatchObject({ beneficiarioId: 'B2', monto: 1500, banco: 'Interbank' });
    expect(depositos[0].fechaPago.getTime()).toBe(depositos[1].fechaPago.getTime());
    expect(prisma.famSolicitudBeneficio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp-activo' },
        data: expect.objectContaining({ estado: 'PAGADA' }),
      }),
    );
  });

  it('reparte el total exacto aunque los porcentajes tengan centavos', () => {
    const montos = (service as any).construirMontosDeposito(3000, [
      { porcentaje: 33.33 },
      { porcentaje: 33.33 },
      { porcentaje: 33.34 },
    ]);
    expect(montos.map((m: any) => m.monto)).toEqual([999.9, 999.9, 1000.2]);
    expect(montos.reduce((acc: number, m: any) => acc + m.monto, 0)).toBeCloseTo(3000, 2);
  });

  it('un expediente pagado solo puede corregirse por el ADMINISTRADOR', async () => {
    const pagado = expedienteActivo({ estado: 'PAGADA' });
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(pagado);

    await expect(
      service.actualizarBeneficiarios(
        'exp-activo',
        {
          beneficiarios: [
            {
              id: 'B1',
              nombre: 'Ana',
              parentesco: 'Hija',
              porcentaje: 50,
              declaracionJurada: PDF_BASE64,
              declaracionJuradaDni: '12345678',
            },
          ],
        } as any,
        'u-1',
        'OPERADOR_PAGOS',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el ADMINISTRADOR puede corregir la declaracion de un expediente pagado', async () => {
    const pagado = expedienteActivo({ estado: 'PAGADA' });
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(pagado);
    prisma.famBeneficiario.findUnique.mockResolvedValue({ id: 'B1', colegiadoId: 'C-7148' });
    prisma.famBeneficiario.update.mockResolvedValue({});
    prisma.famSolicitudBeneficiario.update.mockResolvedValue({});
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({ id: 'exp-activo' } as any);

    await service.actualizarBeneficiarios(
      'exp-activo',
      {
        beneficiarios: [
          {
            id: 'B1',
            nombre: 'Ana',
            parentesco: 'Hija',
            porcentaje: 50,
            declaracionJurada: PDF_BASE64,
            declaracionJuradaDni: '12345678',
          },
        ],
      } as any,
      'admin-1',
      'ADMINISTRADOR',
    );

    expect(prisma.famSolicitudBeneficiario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ declaracionJurada: PDF_BASE64 }),
      }),
    );
  });

  it('permite agregar el segundo beneficiario a un expediente parcial', async () => {
    const parcial = expedienteActivo();
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(parcial);
    prisma.famBeneficiario.findUnique.mockResolvedValue({ id: 'B2', colegiadoId: 'C-7148' });
    prisma.famBeneficiario.create.mockResolvedValue({ id: 'B2' });
    prisma.famBeneficiario.update.mockResolvedValue({});
    prisma.famSolicitudBeneficiario.update.mockResolvedValue({});
    prisma.famSolicitudBeneficiario.create.mockResolvedValue({});
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({ id: 'exp-activo' } as any);

    await service.actualizarBeneficiarios(
      'exp-activo',
      {
        beneficiarios: [
          {
            id: 'B1',
            nombre: 'Ana',
            parentesco: 'Hija',
            porcentaje: 50,
            declaracionJurada: PDF_BASE64,
            declaracionJuradaDni: '12345678',
          },
          {
            nombre: 'Luis',
            dni: '22222222',
            parentesco: 'Hijo',
            porcentaje: 50,
            declaracionJurada: PDF_BASE64,
            declaracionJuradaDni: '87654321',
          },
        ],
      } as any,
      'u-1',
      'OPERADOR_PAGOS',
    );

    expect(prisma.famSolicitudBeneficiario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ beneficiarioId: 'B2', porcentajeAsignado: 50 }),
      }),
    );
  });

  it('rechaza porcentajes que exceden el 100%', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(expedienteActivo());

    await expect(
      service.actualizarBeneficiarios(
        'exp-activo',
        {
          beneficiarios: [
            { id: 'B1', nombre: 'Ana', parentesco: 'Hija', porcentaje: 70 },
            { id: 'B2', nombre: 'Luis', parentesco: 'Hijo', porcentaje: 40 },
          ],
        } as any,
        'u-1',
        'OPERADOR_PAGOS',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FamBeneficiosService - Declaracion Jurada', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
  });

  it('guarda el PDF y el DNI juntos, con el DNI normalizado', async () => {
    await service.actualizar(
      'exp-1',
      { declaracionJurada: PDF_BASE64, declaracionJuradaDni: ' 12345678 ' } as any,
      'ADMINISTRADOR',
    );

    const data = datosDeUpdate(prisma);
    expect(data.declaracionJurada).toBe(PDF_BASE64);
    expect(data.declaracionJuradaDni).toBe('12345678');
  });

  it('rechaza la DJ sin DNI cuando el expediente no tiene uno previo', async () => {
    await expect(
      service.actualizar('exp-1', { declaracionJurada: PDF_BASE64 } as any, 'ADMINISTRADOR'),
    ).rejects.toThrow('requiere el DNI del declarante');
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
  });

  it('reutiliza el DNI ya registrado al reemplazar solo el PDF', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      ...solicitudExistente,
      declaracionJuradaDni: '87654321',
    });

    await service.actualizar(
      'exp-1',
      { declaracionJurada: PDF_BASE64 } as any,
      'ADMINISTRADOR',
    );

    const data = datosDeUpdate(prisma);
    expect(data.declaracionJurada).toBe(PDF_BASE64);
    expect(data).not.toHaveProperty('declaracionJuradaDni');
  });

  it('rechaza un DNI de declarante con formato invalido', async () => {
    await expect(
      service.actualizar('exp-1', { declaracionJuradaDni: '123' } as any, 'ADMINISTRADOR'),
    ).rejects.toThrow('exactamente 8 digitos');
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
  });

  it('permite limpiar el DNI enviando cadena vacia', async () => {
    await service.actualizar('exp-1', { declaracionJuradaDni: '' } as any, 'ADMINISTRADOR');
    expect(datosDeUpdate(prisma).declaracionJuradaDni).toBeNull();
  });

  it('crearRegistro exige el DNI cuando llega la Declaracion Jurada', async () => {
    await expect(
      service.crearRegistro(
        { colegiadoId: 'C-7148', beneficiarios: [], declaracionJurada: PDF_BASE64 } as any,
        'u-1',
      ),
    ).rejects.toThrow('requiere el DNI del declarante');
    expect(prisma.famSolicitudBeneficio.create).not.toHaveBeenCalled();
  });

  it('obtenerPorId devuelve el DNI y no expone el PDF en base64', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      ...solicitudExistente,
      declaracionJurada: PDF_BASE64,
      declaracionJuradaDni: '12345678',
      tipoBeneficio: { codigo: 'FALLECIMIENTO' },
      vinculos: [],
    });
    prisma.famSolicitudBeneficio.findMany.mockResolvedValue([]);
    prisma.famCovidAsignacion.findMany.mockResolvedValue([]);
    prisma.tipoBeneficio.findMany.mockResolvedValue([]);

    const famMock = {
      buscarColegiadosPorIds: jest.fn().mockResolvedValue(new Map()),
    } as any;
    const svc = new FamBeneficiosService(prisma as any, auditService, famMock);

    const detalle: any = await svc.obtenerPorId('exp-1');

    expect(detalle.declaracionJuradaDni).toBe('12345678');
    expect(detalle).not.toHaveProperty('declaracionJurada');
    expect(detalle.documentosDisponibles.declaracionJurada).toBe(true);
  });
});

describe('FamBeneficiosService - datos especiales del expediente', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
  });

  it('actualizar guarda fechas como Date y textos sin espacios', async () => {
    await service.actualizar(
      'exp-1',
      {
        fechaDefuncion: '2026-10-01',
        causaFallecimiento: '  Infarto  ',
        fechaDiagnostico: '2026-09-15',
        diagnosticoMedico: 'Cancer terminal',
        fechaAccidente: '2026-08-20',
        descripcionAccidente: 'Caida en obra',
      } as any,
      'ADMINISTRADOR',
    );

    const data = datosDeUpdate(prisma);
    expect(data.fechaDefuncion).toEqual(new Date('2026-10-01'));
    expect(data.causaFallecimiento).toBe('Infarto');
    expect(data.fechaDiagnostico).toEqual(new Date('2026-09-15'));
    expect(data.diagnosticoMedico).toBe('Cancer terminal');
    expect(data.fechaAccidente).toEqual(new Date('2026-08-20'));
    expect(data.descripcionAccidente).toBe('Caida en obra');
  });

  it('actualizar no toca los datos especiales que no se envian', async () => {
    await service.actualizar('exp-1', { monto: 1500 } as any, 'ADMINISTRADOR');

    const data = datosDeUpdate(prisma);
    for (const campo of [
      'fechaDefuncion',
      'causaFallecimiento',
      'fechaDiagnostico',
      'diagnosticoMedico',
      'fechaAccidente',
      'descripcionAccidente',
    ]) {
      expect(data).not.toHaveProperty(campo);
    }
  });

  it('actualizar permite limpiar los datos especiales con cadena vacia', async () => {
    await service.actualizar(
      'exp-1',
      { fechaDefuncion: '', causaFallecimiento: '   ', fechaAccidente: null } as any,
      'ADMINISTRADOR',
    );

    const data = datosDeUpdate(prisma);
    expect(data.fechaDefuncion).toBeNull();
    expect(data.causaFallecimiento).toBeNull();
    expect(data.fechaAccidente).toBeNull();
  });

  it('obtenerPorId expone los datos especiales guardados', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      ...solicitudExistente,
      fechaDefuncion: new Date('2026-10-01'),
      causaFallecimiento: 'Infarto',
      tipoBeneficio: { codigo: 'FALLECIMIENTO' },
      vinculos: [],
    });
    prisma.famSolicitudBeneficio.findMany.mockResolvedValue([]);
    prisma.famCovidAsignacion.findMany.mockResolvedValue([]);
    prisma.tipoBeneficio.findMany.mockResolvedValue([]);

    const famMock = {
      buscarColegiadosPorIds: jest.fn().mockResolvedValue(new Map()),
    } as any;
    const svc = new FamBeneficiosService(prisma as any, auditService, famMock);

    const detalle: any = await svc.obtenerPorId('exp-1');

    expect(detalle.fechaDefuncion).toEqual(new Date('2026-10-01'));
    expect(detalle.causaFallecimiento).toBe('Infarto');
  });
});

describe('FamBeneficiosService - trazabilidad y alias de tipos operacionales', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  const expedienteIncapacidad = (overrides: Record<string, any> = {}) => ({
    id: 'exp-activo',
    colegiadoId: 'C-7148',
    estado: 'PENDIENTE',
    tipoBeneficioId: 'TB-FAM-002',
    monto: 2000,
    montoFinal: null,
    sucesionIntestada: null,
    solicitanteNombre: null,
    solicitanteDni: null,
    vinculos: [
      {
        beneficiarioId: 'B1',
        porcentajeAsignado: 100,
        declaracionJurada: PDF_BASE64,
        declaracionJuradaDni: '12345678',
        beneficiario: { id: 'B1', nombre: 'Ana', dni: '11111111' },
      },
    ],
    depositos: [],
    tipoBeneficio: { id: 'TB-FAM-002', codigo: 'INCAPACIDAD', nombre: 'Incapacidad' },
    ...overrides,
  });

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
    auditService.log.mockClear();
  });

  it('resuelve "Accidente Grave" al tipo operacional INCAPACIDAD', async () => {
    prisma.tipoBeneficioConfig.findUnique.mockResolvedValue({ id: 7, nombre: 'Accidente Grave' });
    prisma.tipoBeneficio.findMany.mockResolvedValue([
      { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
      { id: 'TB-FAM-002', codigo: 'INCAPACIDAD', nombre: 'Incapacidad' },
    ]);
    prisma.famSolicitudBeneficio.findFirst.mockResolvedValue(expedienteIncapacidad());

    const resumen: any = await service.obtenerExpedienteActivoResumen('C-7148', undefined, '7');

    expect(resumen.tipoBeneficio.codigo).toBe('INCAPACIDAD');
    expect(resumen.porcentajeAsignado).toBe(100);
    expect(resumen.listoParaPago).toBe(true);
    expect(prisma.famSolicitudBeneficio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          colegiadoId: 'C-7148',
          estado: { not: 'RECHAZADA' },
          tipoBeneficio: { codigo: 'INCAPACIDAD' },
        }),
      }),
    );
  });

  it('crearRegistro con "Accidente Grave" usa INCAPACIDAD y no crea un tipo espurio', async () => {
    prisma.tipoBeneficioConfig.findUnique.mockResolvedValue({ id: 7, nombre: 'Accidente Grave' });
    prisma.tipoBeneficio.findMany.mockResolvedValue([
      { id: 'TB-FAM-002', codigo: 'INCAPACIDAD', nombre: 'Incapacidad' },
    ]);
    prisma.famSolicitudBeneficio.findFirst.mockResolvedValue(null);
    prisma.famSolicitudBeneficio.create.mockResolvedValue({ id: 'exp-nuevo' });
    prisma.famBeneficiario.create.mockResolvedValue({ id: 'B1' });
    prisma.famSolicitudBeneficiario.create.mockResolvedValue({});
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({ id: 'exp-nuevo' } as any);

    await service.crearRegistro(
      {
        colegiadoId: 'C-7148',
        documentacionCompleta: true,
        tipoBeneficioConfigId: 7,
        monto: 2000,
        modalidadBeneficio: 'monto_compartido',
        beneficiarios: [{ nombre: 'Ana', parentesco: 'Hija', porcentaje: 100 }],
        solicitanteIndice: 0,
      } as any,
      'u-1',
      '127.0.0.1',
    );

    expect(prisma.tipoBeneficio.create).not.toHaveBeenCalled();
    expect(prisma.famSolicitudBeneficio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoBeneficioId: 'TB-FAM-002' }),
      }),
    );
  });

  it('bloquea marcar PAGADA por el formulario admin si el tipo es bolsa y no hay depositos', async () => {
    prisma.famDepositoBeneficiario.count.mockResolvedValue(0);

    const err: any = await service
      .actualizar('exp-1', { estado: 'PAGADA' } as any, 'ADMINISTRADOR')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toContain('Registrar pago');
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
  });

  it('permite conservar PAGADA cuando ya existen depositos', async () => {
    prisma.famDepositoBeneficiario.count.mockResolvedValue(1);

    await service.actualizar('exp-1', { estado: 'PAGADA' } as any, 'ADMINISTRADOR');

    expect(prisma.famSolicitudBeneficio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'PAGADA' }) }),
    );
  });

  it('pagar registra trazabilidad con usuario, IP y depositos generados', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(expedienteIncapacidad());
    prisma.famSolicitudBeneficio.update.mockResolvedValue({});
    prisma.famDepositoBeneficiario.create.mockResolvedValue({});
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({ id: 'exp-activo' } as any);

    await service.pagar(
      'exp-activo',
      { fechaPago: '2026-10-22', depositos: [{ beneficiarioId: 'B1', banco: 'BCP', numeroCuenta: '111' }] },
      'u-1',
      '10.0.0.5',
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        action: 'UPDATE',
        entity: 'fam_registro',
        entityId: 'exp-activo',
        ipAddress: '10.0.0.5',
        changes: expect.objectContaining({
          pago: expect.objectContaining({
            old: expect.objectContaining({ estado: 'PENDIENTE' }),
            new: expect.objectContaining({
              estado: 'PAGADA',
              depositos: [expect.objectContaining({ beneficiarioId: 'B1', monto: 2000 })],
            }),
          }),
        }),
      }),
    );
  });

  it('actualizarBeneficiarios registra old/new de los beneficiarios en auditoria', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(expedienteIncapacidad());
    prisma.famBeneficiario.findUnique.mockResolvedValue({ id: 'B1', colegiadoId: 'C-7148' });
    prisma.famBeneficiario.update.mockResolvedValue({});
    prisma.famSolicitudBeneficiario.update.mockResolvedValue({});
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({ id: 'exp-activo' } as any);

    await service.actualizarBeneficiarios(
      'exp-activo',
      {
        beneficiarios: [
          {
            id: 'B1',
            nombre: 'Ana Maria',
            parentesco: 'Hija',
            porcentaje: 100,
            declaracionJurada: PDF_BASE64,
            declaracionJuradaDni: '12345678',
          },
        ],
      } as any,
      'admin-1',
      'ADMINISTRADOR',
      '10.0.0.6',
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'UPDATE',
        entity: 'fam_registro',
        entityId: 'exp-activo',
        ipAddress: '10.0.0.6',
        changes: expect.objectContaining({
          beneficiarios: {
            old: [expect.objectContaining({ id: 'B1', porcentaje: 100 })],
            new: [expect.objectContaining({ id: 'B1', nombre: 'Ana Maria', porcentaje: 100 })],
          },
        }),
      }),
    );
  });

  it('actualizarDeposito rechaza a OPERADOR_PAGOS sin consultar ni modificar', async () => {
    await expect(
      service.actualizarDeposito('exp-1', 'dep-1', { banco: 'BCP' } as any, 'u-1', 'OPERADOR_PAGOS'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.famDepositoBeneficiario.findFirst).not.toHaveBeenCalled();
    expect(prisma.famDepositoBeneficiario.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('actualizarDeposito del ADMINISTRADOR registra old/new y la IP', async () => {
    prisma.famDepositoBeneficiario.findFirst.mockResolvedValue({
      id: 'dep-1',
      banco: 'BCP',
      numeroCuenta: '111',
      cci: null,
      comprobantePdf: null,
      fechaPago: new Date('2026-10-22T00:00:00.000Z'),
    });
    prisma.famDepositoBeneficiario.update.mockResolvedValue({
      id: 'dep-1',
      banco: 'Interbank',
      numeroCuenta: '222',
      cci: null,
      comprobantePdf: null,
      fechaPago: new Date('2026-10-22T00:00:00.000Z'),
    });

    await service.actualizarDeposito(
      'exp-1',
      'dep-1',
      { banco: 'Interbank', numeroCuenta: '222' } as any,
      'admin-1',
      'ADMINISTRADOR',
      '10.0.0.7',
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'UPDATE',
        entity: 'fam_deposito',
        entityId: 'dep-1',
        ipAddress: '10.0.0.7',
        changes: expect.objectContaining({
          deposito: {
            old: expect.objectContaining({ banco: 'BCP', numeroCuenta: '111' }),
            new: expect.objectContaining({ banco: 'Interbank', numeroCuenta: '222' }),
          },
        }),
      }),
    );
  });
});

describe('FamBeneficiosService.historial - lectura y subida de documentos', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  const expedienteHistorial = (overrides: Record<string, any> = {}) => ({
    id: 'exp-1',
    colegiadoId: 'C-7148',
    estado: 'PAGADA',
    tipoBeneficioId: 'TB-FAM-001',
    monto: 3000,
    montoFinal: null,
    documentacionCompleta: true,
    documentacionObservacion: null,
    fechaSolicitud: new Date('2026-01-10T00:00:00.000Z'),
    fechaPago: new Date('2026-02-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    registradoPor: 'u-1',
    expedienteNumero: 'EXP-1',
    ordenPago: null,
    fichaAdmisibilidad: PDF_BASE64,
    solicitudAsignacion: null,
    cartaRemision: null,
    memorando: null,
    sucesionIntestada: null,
    declaracionJurada: null,
    actaDefuncion: PDF_BASE64,
    tipoBeneficio: { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
    vinculos: [
      {
        beneficiarioId: 'B1',
        porcentajeAsignado: 100,
        declaracionJurada: PDF_BASE64,
        declaracionJuradaDni: '12345678',
        ordenPago: PDF_BASE64,
        beneficiario: { id: 'B1', nombre: 'Ana', dni: '11111111' },
      },
    ],
    depositos: [
      {
        id: 'dep-1',
        nombreBeneficiario: 'Ana',
        monto: 3000,
        comprobantePdf: PDF_BASE64,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
    (auditService.log as jest.Mock).mockClear();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.usuario.findMany.mockResolvedValue([]);
  });

  it('devuelve 5 etapas completas y documentos reales de un expediente pagado', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(expedienteHistorial());

    const historial: any = await service.obtenerHistorial('exp-1', 'AUDITOR');

    expect(historial.etapas.map((e: any) => e.nombre)).toEqual([
      'Registro',
      'Documentos',
      'Revisión',
      'Aprobado',
      'Pagado',
    ]);
    expect(historial.etapas.every((e: any) => e.estado === 'completado')).toBe(true);
    expect(historial.siguientePaso.titulo).toBe('Pago registrado');
    expect(historial.permisos.puedeSubirDocumentos).toBe(false);
    expect(historial.documentos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'exp:fichaAdmisibilidad', cargado: true }),
        expect.objectContaining({ id: 'ben:B1:declaracionJurada', cargado: true }),
        expect.objectContaining({ id: 'dep:dep-1:comprobante', cargado: true }),
      ]),
    );
  });

  it('expone los beneficiarios vinculados con su reparto y estado documental', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(
      expedienteHistorial({
        vinculos: [
          {
            beneficiarioId: 'B1',
            porcentajeAsignado: 50,
            declaracionJurada: PDF_BASE64,
            declaracionJuradaDni: '12345678',
            ordenPago: PDF_BASE64,
            beneficiario: { id: 'B1', nombre: 'Ana', dni: '11111111', parentesco: 'Hija' },
          },
          {
            beneficiarioId: 'B2',
            porcentajeAsignado: 50,
            declaracionJurada: null,
            declaracionJuradaDni: null,
            ordenPago: null,
            beneficiario: { id: 'B2', nombre: 'Luis', dni: '22222222', parentesco: 'Hijo' },
          },
        ],
      }),
    );

    const historial: any = await service.obtenerHistorial('exp-1', 'ADMINISTRADOR');

    expect(historial.beneficiarios).toHaveLength(2);
    expect(historial.beneficiarios[0]).toMatchObject({
      id: 'B1',
      nombre: 'Ana',
      porcentaje: 50,
      tieneDeclaracionJurada: true,
      tieneOrdenPago: true,
    });
    expect(historial.beneficiarios[1]).toMatchObject({
      id: 'B2',
      nombre: 'Luis',
      porcentaje: 50,
      tieneDeclaracionJurada: false,
      tieneOrdenPago: false,
    });
    expect(historial.resumen.beneficiarios).toBe(2);
  });

  it('en un pendiente sin documentacion marca Documentos como actual y ofrece subir', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue(
      expedienteHistorial({
        estado: 'PENDIENTE',
        documentacionCompleta: false,
        documentacionObservacion: 'Falta memorando',
        fechaPago: null,
        depositos: [],
        actaDefuncion: null,
        fichaAdmisibilidad: null,
      }),
    );

    const historial: any = await service.obtenerHistorial('exp-1', 'OPERADOR_PAGOS');
    const documentos = historial.etapas.find((e: any) => e.key === 'documentos');

    expect(documentos.estado).toBe('actual');
    expect(historial.siguientePaso.titulo).toBe('Completar documentación');
    expect(historial.siguientePaso.descripcion).toBe('Falta memorando');
    expect(historial.siguientePaso.accion).toMatchObject({ tipo: 'SUBIR' });
    expect(historial.permisos.puedeSubirDocumentos).toBe(true);
  });

  it('un AUDITOR no puede subir documentos aun en un expediente no pagado', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      id: 'exp-1',
      estado: 'PENDIENTE',
      memorando: null,
    });

    await expect(
      service.subirDocumentoHistorial('exp-1', 'memorando', PDF_BASE64, 'aud-1', 'AUDITOR', '10.0.0.1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('un OPERADOR no puede subir documentos a un expediente pagado', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      id: 'exp-1',
      estado: 'PAGADA',
      memorando: null,
    });

    await expect(
      service.subirDocumentoHistorial('exp-1', 'memorando', PDF_BASE64, 'op-1', 'OPERADOR_PAGOS', '10.0.0.2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.famSolicitudBeneficio.update).not.toHaveBeenCalled();
  });

  it('el ADMINISTRADOR sube un documento y registra auditoria estructurada', async () => {
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      id: 'exp-1',
      estado: 'PAGADA',
      memorando: null,
    });
    prisma.famSolicitudBeneficio.update.mockResolvedValue({});

    const resultado = await service.subirDocumentoHistorial(
      'exp-1',
      'memorando',
      PDF_BASE64,
      'admin-1',
      'ADMINISTRADOR',
      '10.0.0.3',
    );

    expect(resultado).toMatchObject({ campo: 'memorando', cargado: true });
    expect(prisma.famSolicitudBeneficio.update).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: { memorando: PDF_BASE64 },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'fam_documento',
        entityId: 'exp-1:memorando',
        changes: {
          documento: {
            old: { cargado: false },
            new: { cargado: true, campo: 'memorando', nombre: 'Memorando' },
          },
        },
      }),
    );
  });

  it('exige DNI para subir la declaracion jurada de un beneficiario', async () => {
    prisma.famSolicitudBeneficiario.findUnique.mockResolvedValue({
      declaracionJurada: null,
      declaracionJuradaDni: null,
      ordenPago: null,
      beneficiario: { nombre: 'Ana' },
      solicitud: { estado: 'PENDIENTE' },
    });

    await expect(
      service.subirDocumentoBeneficiarioHistorial(
        'exp-1',
        'B1',
        'declaracionJurada',
        { contenido: PDF_BASE64 },
        'admin-1',
        'ADMINISTRADOR',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.famSolicitudBeneficiario.update).not.toHaveBeenCalled();
  });

  it('un OPERADOR no puede subir comprobantes de deposito', async () => {
    await expect(
      service.subirComprobanteDepositoHistorial(
        'exp-1',
        'dep-1',
        PDF_BASE64,
        'op-1',
        'OPERADOR_PAGOS',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.famDepositoBeneficiario.findFirst).not.toHaveBeenCalled();
  });
});

describe('FamBeneficiosService.eliminar - borrado completo del expediente', () => {
  let prisma: ReturnType<typeof crearPrismaMock>;
  let service: FamBeneficiosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = montarService(prisma);
    auditService.log.mockClear();
    prisma.famSolicitudBeneficio.findUnique.mockResolvedValue({
      ...solicitudExistente,
      tipoBeneficio: { id: 'TB-FAM-001', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
      estado: 'PAGADA',
      fechaSolicitud: new Date('2026-10-01T10:00:00.000Z'),
      fechaPago: new Date('2026-10-02T10:00:00.000Z'),
      expedienteNumero: 'EXP-2026-0001',
      cartaNumero: 'CARTA-1',
      memorandoNumero: 'MEMO-1',
      modalidadBeneficio: 'MONTO_COMPARTIDO',
      descuentoCovid: 0,
      montoFinal: 3000,
      registradoPor: 'admin-1',
      memorando: PDF_BASE64,
      vinculos: [
        {
          beneficiarioId: 'B1',
          porcentajeAsignado: 100,
          declaracionJurada: PDF_BASE64,
          ordenPago: null,
          beneficiario: { nombre: 'Ana Perez', dni: '12345678' },
        },
      ],
      depositos: [
        {
          id: 'DEP-1',
          beneficiarioId: 'B1',
          nombreBeneficiario: 'Ana Perez',
          monto: 3000,
          estado: 'PAGADO',
          comprobantePdf: PDF_BASE64,
        },
      ],
    });
    prisma.famDepositoBeneficiario.deleteMany.mockResolvedValue({ count: 1 });
    prisma.famSolicitudBeneficiario.deleteMany.mockResolvedValue({ count: 1 });
    prisma.famSolicitudBeneficio.delete.mockResolvedValue({ id: 'exp-1' });
  });

  it('elimina depositos, vinculos y expediente auditoria sin duplicar PDFs', async () => {
    const resultado = await service.eliminar('exp-1', 'admin-1', '192.168.1.10');

    expect(prisma.famDepositoBeneficiario.deleteMany).toHaveBeenCalledWith({
      where: { solicitudId: 'exp-1' },
    });
    expect(prisma.famSolicitudBeneficiario.deleteMany).toHaveBeenCalledWith({
      where: { solicitudId: 'exp-1' },
    });
    expect(prisma.famSolicitudBeneficio.delete).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
    });

    expect(auditService.log).toHaveBeenCalledTimes(1);
    const auditoria = auditService.log.mock.calls[0][0];
    expect(auditoria).toMatchObject({
      userId: 'admin-1',
      action: 'DELETE',
      entity: 'fam_registro',
      entityId: 'exp-1',
      ipAddress: '192.168.1.10',
    });
    expect(auditoria.changes.registro.new).toBeNull();
    expect(auditoria.changes.registro.old).toMatchObject({
      estado: 'PAGADA',
      expedienteNumero: 'EXP-2026-0001',
      documentos: { memorando: true },
      beneficiarios: [
        {
          beneficiarioId: 'B1',
          nombre: 'Ana Perez',
          porcentaje: 100,
          tieneDeclaracionJurada: true,
          tieneOrdenPago: false,
        },
      ],
      depositos: [
        {
          id: 'DEP-1',
          nombreBeneficiario: 'Ana Perez',
          monto: 3000,
          estado: 'PAGADO',
          tieneComprobante: true,
        },
      ],
    });
    expect(JSON.stringify(auditoria.changes.registro.old)).not.toContain('PDF-1.4');
    expect(resultado.message).toBe('Solicitud eliminada exitosamente');
  });

  it('permite eliminar un expediente PAGADA', async () => {
    await expect(service.eliminar('exp-1', 'admin-1')).resolves.toBeDefined();
    expect(prisma.famSolicitudBeneficio.delete).toHaveBeenCalled();
  });
});
