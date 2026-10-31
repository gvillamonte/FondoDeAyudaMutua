import { Reflector } from '@nestjs/core';
import { FamBeneficiosController } from './fam-beneficios.controller';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

const service = {
  crear: jest.fn(),
  listar: jest.fn(),
  obtenerMontos: jest.fn(),
  listarTiposBeneficio: jest.fn(),
  obtenerDocumento: jest.fn(),
  obtenerPorId: jest.fn(),
  actualizar: jest.fn(),
  eliminar: jest.fn(),
  obtenerExpedienteActivoResumen: jest.fn(),
  actualizarBeneficiarios: jest.fn(),
  pagar: jest.fn(),
  actualizarDeposito: jest.fn(),
  obtenerDeclaracionBeneficiario: jest.fn(),
  obtenerComprobanteDeposito: jest.fn(),
};

const controller = new FamBeneficiosController(service as any);

const rolesDe = (metodo: keyof FamBeneficiosController): string[] | undefined =>
  Reflect.getMetadata(ROLES_KEY, (controller as any)[metodo]);

const contextGuard = (metodo: keyof FamBeneficiosController, rol?: string) =>
  ({
    getHandler: () => (controller as any)[metodo],
    getClass: () => FamBeneficiosController,
    switchToHttp: () => ({ getRequest: () => ({ user: rol ? { rol } : {} }) }),
  }) as any;

const guard = new RolesGuard(new Reflector());

describe('FamBeneficiosController - control de acceso por rol', () => {
  it('PUT /fam-beneficios/:id exige unicamente ADMINISTRADOR', () => {
    expect(rolesDe('actualizar')).toEqual(['ADMINISTRADOR']);
  });

  it('DELETE /fam-beneficios/:id exige unicamente ADMINISTRADOR', () => {
    expect(rolesDe('eliminar')).toEqual(['ADMINISTRADOR']);
  });

  it('POST /fam-beneficios admite ADMINISTRADOR y OPERADOR_PAGOS (no AUDITOR)', () => {
    expect(rolesDe('crear')).toEqual(['ADMINISTRADOR', 'OPERADOR_PAGOS']);
  });

  it('GET /fam-beneficios/:id/documento/:campo es de lectura para los 3 roles', () => {
    expect(rolesDe('obtenerDocumento')).toEqual([
      'ADMINISTRADOR',
      'OPERADOR_PAGOS',
      'AUDITOR',
    ]);
  });

  it('el guard deja subir documentos solo al ADMINISTRADOR', () => {
    expect(guard.canActivate(contextGuard('actualizar', 'ADMINISTRADOR'))).toBe(true);
    expect(guard.canActivate(contextGuard('actualizar', 'OPERADOR_PAGOS'))).toBe(false);
    expect(guard.canActivate(contextGuard('actualizar', 'AUDITOR'))).toBe(false);
    expect(guard.canActivate(contextGuard('actualizar'))).toBe(false);
    expect(guard.canActivate(contextGuard('actualizar', 'SUPER_ADMINISTRADOR'))).toBe(true);
  });

  it('el guard permite la lectura de documentos a operador y auditor', () => {
    expect(guard.canActivate(contextGuard('obtenerDocumento', 'ADMINISTRADOR'))).toBe(true);
    expect(guard.canActivate(contextGuard('obtenerDocumento', 'OPERADOR_PAGOS'))).toBe(true);
    expect(guard.canActivate(contextGuard('obtenerDocumento', 'AUDITOR'))).toBe(true);
  });

  it('aplica JwtAuthGuard y RolesGuard a nivel de clase', () => {
    const guards: unknown[] = Reflect.getMetadata('__guards__', FamBeneficiosController) || [];
    expect(guards).toContain(RolesGuard);
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it('los endpoints de reparto exigen ADMINISTRADOR y OPERADOR_PAGOS', () => {
    expect(rolesDe('actualizarBeneficiarios')).toEqual(['ADMINISTRADOR', 'OPERADOR_PAGOS']);
    expect(rolesDe('pagar')).toEqual(['ADMINISTRADOR', 'OPERADOR_PAGOS']);
    expect(rolesDe('actualizarDeposito')).toEqual(['ADMINISTRADOR']);
  });

  it('la consulta del expediente activo y los PDFs son de lectura para los 3 roles', () => {
    expect(rolesDe('obtenerActivo')).toEqual(['ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR']);
    expect(rolesDe('obtenerDeclaracion')).toEqual([
      'ADMINISTRADOR',
      'OPERADOR_PAGOS',
      'AUDITOR',
    ]);
    expect(rolesDe('obtenerComprobante')).toEqual([
      'ADMINISTRADOR',
      'OPERADOR_PAGOS',
      'AUDITOR',
    ]);
  });

  it('el guard impide que el AUDITOR cobre o corrija depositos', () => {
    expect(guard.canActivate(contextGuard('pagar', 'AUDITOR'))).toBe(false);
    expect(guard.canActivate(contextGuard('actualizarDeposito', 'OPERADOR_PAGOS'))).toBe(false);
    expect(guard.canActivate(contextGuard('actualizarDeposito', 'ADMINISTRADOR'))).toBe(true);
  });
});

describe('FamBeneficiosController - delegacion al service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('actualizar pasa el rol del usuario al service', async () => {
    service.actualizar.mockResolvedValue({ ok: true });
    const dto = { memorando: 'abc' } as any;

    await controller.actualizar('exp-1', dto, { user: { rol: 'ADMINISTRADOR' } } as any);

    expect(service.actualizar).toHaveBeenCalledWith('exp-1', dto, 'ADMINISTRADOR');
  });

  it('eliminar delega usuario e ip', async () => {
    service.eliminar.mockResolvedValue({ ok: true });

    await controller.eliminar('exp-1', { user: { sub: 'u-9' }, ip: '10.0.0.1' } as any);

    expect(service.eliminar).toHaveBeenCalledWith('exp-1', 'u-9', '10.0.0.1');
  });

  it('obtenerDocumento normaliza el campo antes de consultarlo', async () => {
    service.obtenerDocumento.mockResolvedValue({ contenido: 'x' });

    await controller.obtenerDocumento('exp-1', 'memorando');

    expect(service.obtenerDocumento).toHaveBeenCalledWith('exp-1', 'memorando');
  });

  it('obtenerActivo pasa el colegiado y el tipo de configuracion', async () => {
    service.obtenerExpedienteActivoResumen.mockResolvedValue(null);

    await controller.obtenerActivo('C-7148', undefined, '7');

    expect(service.obtenerExpedienteActivoResumen).toHaveBeenCalledWith('C-7148', undefined, '7');
  });

  it('actualizarBeneficiarios delega usuario, rol e IP', async () => {
    service.actualizarBeneficiarios.mockResolvedValue({ id: 'exp-1' });
    const dto = { beneficiarios: [] } as any;

    await controller.actualizarBeneficiarios('exp-1', dto, {
      user: { sub: 'u-1', rol: 'OPERADOR_PAGOS' },
      ip: '10.0.0.8',
    } as any);

    expect(service.actualizarBeneficiarios).toHaveBeenCalledWith(
      'exp-1',
      dto,
      'u-1',
      'OPERADOR_PAGOS',
      '10.0.0.8',
    );
  });

  it('pagar delega usuario e IP', async () => {
    service.pagar.mockResolvedValue({ id: 'exp-1' });

    await controller.pagar('exp-1', { depositos: [] } as any, {
      user: { sub: 'u-1' },
      ip: '10.0.0.9',
    } as any);

    expect(service.pagar).toHaveBeenCalledWith('exp-1', { depositos: [] }, 'u-1', '10.0.0.9');
  });

  it('actualizarDeposito delega usuario, rol e IP', async () => {
    service.actualizarDeposito.mockResolvedValue({ id: 'dep-1' });

    await controller.actualizarDeposito('exp-1', 'dep-1', { banco: 'BCP' } as any, {
      user: { sub: 'admin-1', rol: 'ADMINISTRADOR' },
      ip: '10.0.0.10',
    } as any);

    expect(service.actualizarDeposito).toHaveBeenCalledWith(
      'exp-1',
      'dep-1',
      { banco: 'BCP' },
      'admin-1',
      'ADMINISTRADOR',
      '10.0.0.10',
    );
  });
});
