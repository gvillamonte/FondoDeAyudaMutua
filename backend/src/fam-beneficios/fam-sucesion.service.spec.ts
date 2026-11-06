import { BadRequestException } from '@nestjs/common';
import { FamSucesionService } from './fam-sucesion.service';

describe('FamSucesionService', () => {
  let service: FamSucesionService;
  let prisma: any;
  let famService: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      tipoBeneficioConfig: { findUnique: jest.fn() },
      tipoBeneficio: { findFirst: jest.fn(), create: jest.fn() },
      famSucesionIntestada: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      famSucesionVersion: { findMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
      famSolicitudBeneficio: { create: jest.fn() },
      famBeneficiario: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      famSucesionBeneficiario: { create: jest.fn(), deleteMany: jest.fn() },
      famSolicitudBeneficiario: { create: jest.fn(), deleteMany: jest.fn() },
      famDepositoBeneficiario: { create: jest.fn() },
    };

    famService = {
      getBeneficiariosByColegiado: jest.fn().mockResolvedValue([]),
    };

    auditService = {
      log: jest.fn().mockResolvedValue({}),
    };

    service = new FamSucesionService(prisma, auditService, famService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe rechazar si el colegiado ya tiene beneficiarios registrados', async () => {
    famService.getBeneficiariosByColegiado.mockResolvedValueOnce([
      { NOMBRE_BENEFICIARIO: 'Existente 1', PORCENTAJE: 100 },
    ]);

    await expect(
      service.registrarSucesion(
        {
          colegiadoId: 'col-1',
          montoTotal: 5000,
          sustentoPdf: 'JVBERi0xLjQK...',
          herederos: [
            {
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              nombres: 'Ana',
              apellidos: 'Perez',
              parentesco: 'Hijo(a)',
              porcentaje: 100,
              monto: 5000,
            },
          ],
        } as any,
        'u-1',
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar si los porcentajes no suman 100%', async () => {
    await expect(
      service.registrarSucesion(
        {
          colegiadoId: 'col-1',
          montoTotal: 5000,
          sustentoPdf: 'JVBERi0xLjQK...',
          herederos: [
            {
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              nombres: 'Ana',
              apellidos: 'Perez',
              parentesco: 'Hijo(a)',
              porcentaje: 60,
              monto: 3000,
            },
            {
              tipoDocumento: 'DNI',
              numeroDocumento: '87654321',
              nombres: 'Luis',
              apellidos: 'Perez',
              parentesco: 'Hijo(a)',
              porcentaje: 30, // 60 + 30 = 90%
              monto: 1500,
            },
          ],
        } as any,
        'u-1',
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar si hay documentos duplicados entre los herederos', async () => {
    await expect(
      service.registrarSucesion(
        {
          colegiadoId: 'col-1',
          montoTotal: 5000,
          sustentoPdf: 'JVBERi0xLjQK...',
          herederos: [
            {
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              nombres: 'Ana',
              apellidos: 'Perez',
              parentesco: 'Hijo(a)',
              porcentaje: 50,
              monto: 2500,
            },
            {
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678', // DUPLICADO
              nombres: 'Ana Copia',
              apellidos: 'Perez',
              parentesco: 'Hijo(a)',
              porcentaje: 50,
              monto: 2500,
            },
          ],
        } as any,
        'u-1',
        '127.0.0.1',
      ),
    ).rejects.toThrow('Documento duplicado');
  });

  it('debe registrar exitosamente cuando los datos son válidos', async () => {
    prisma.tipoBeneficio.findFirst.mockResolvedValueOnce({
      id: 'tb-1',
      codigo: 'FALLECIMIENTO',
      nombre: 'Fallecimiento',
    });
    prisma.famSolicitudBeneficio.create.mockResolvedValueOnce({ id: 'sol-1' });
    prisma.famSucesionIntestada.create.mockResolvedValueOnce({ id: 'suc-1', estadoTramite: 'BORRADOR' });
    prisma.famBeneficiario.create.mockResolvedValue({ id: 'ben-1' });
    prisma.famSucesionBeneficiario.create.mockResolvedValue({ id: 'sb-1' });
    prisma.famSolicitudBeneficiario.create.mockResolvedValue({ id: 1 });
    prisma.famSucesionVersion.create.mockResolvedValue({ id: 'v-1' });

    const res = await service.registrarSucesion(
      {
        colegiadoId: 'col-1',
        montoTotal: 5000,
        sustentoPdf: 'JVBERi0xLjQK...',
        herederos: [
          {
            tipoDocumento: 'DNI',
            numeroDocumento: '12345678',
            nombres: 'Ana',
            apellidos: 'Perez',
            parentesco: 'Hijo(a)',
            porcentaje: 50,
            monto: 2500,
          },
          {
            tipoDocumento: 'DNI',
            numeroDocumento: '87654321',
            nombres: 'Carlos',
            apellidos: 'Perez',
            parentesco: 'Hijo(a)',
            porcentaje: 50,
            monto: 2500,
          },
        ],
      } as any,
      'u-1',
      '127.0.0.1',
    );

    expect(res).toBeDefined();
    expect(res.solicitud.id).toBe('sol-1');
    expect(res.sucesion.id).toBe('suc-1');
    expect(auditService.log).toHaveBeenCalled();
  });

  it('debe obtener la declaración jurada y voucher de un heredero', async () => {
    prisma.famSucesionBeneficiario.findFirst = jest.fn().mockResolvedValue({
      id: 'h-1',
      sucesionId: 'suc-1',
      numeroDocumento: '12345678',
      nombres: 'Ana',
      apellidos: 'Perez',
      porcentaje: 50,
      monto: 1500,
      declaracionJuradaPdf: 'JVBERi0xLjQK...',
      ordenPagoPdf: 'JVBERi0xLjQK...',
    });

    const dj = await service.obtenerDeclaracionHeredero('suc-1', 'h-1');
    expect(dj.contenido).toBe('JVBERi0xLjQK...');
    expect(dj.numeroDocumento).toBe('12345678');

    const voucher = await service.obtenerVoucherHeredero('suc-1', 'h-1');
    expect(voucher.contenido).toBe('JVBERi0xLjQK...');
    expect(voucher.monto).toBe(1500);
  });

  it('debe permitir guardar cuando no tiene sustento PDF pero cuenta con observaciones de justificación', async () => {
    prisma.tipoBeneficio.findFirst.mockResolvedValueOnce({
      id: 'tb-1',
      codigo: 'FALLECIMIENTO',
      nombre: 'Fallecimiento',
    });
    prisma.famSolicitudBeneficio.create.mockResolvedValueOnce({ id: 'sol-2' });
    prisma.famSucesionIntestada.create.mockResolvedValueOnce({ id: 'suc-2', estadoTramite: 'BORRADOR' });
    prisma.famBeneficiario.create.mockResolvedValue({ id: 'ben-2' });
    prisma.famSucesionBeneficiario.create.mockResolvedValue({ id: 'sb-2' });
    prisma.famSolicitudBeneficiario.create.mockResolvedValue({ id: 2 });
    prisma.famSucesionVersion.create.mockResolvedValue({ id: 'v-2' });

    const res = await service.registrarSucesion(
      {
        colegiadoId: 'col-1',
        montoTotal: 5000,
        observacionSinSucesion: 'Trámite notarial de sucesión intestada en proceso en Notaría Albarracín',
        herederos: [
          {
            tipoDocumento: 'DNI',
            numeroDocumento: '12345678',
            nombres: 'Ana',
            apellidos: 'Perez',
            parentesco: 'Hijo(a)',
            porcentaje: 100,
            monto: 5000,
          },
        ],
      } as any,
      'u-1',
      '127.0.0.1',
    );

    expect(res).toBeDefined();
    expect(res.solicitud.id).toBe('sol-2');
  });
});
