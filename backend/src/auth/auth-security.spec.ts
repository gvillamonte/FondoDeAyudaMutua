import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { RolesController } from '../usuarios/roles.controller';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('Auditoría de Seguridad - Pruebas Unitarias de Endpoints P1 y P4', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const contextGuard = (handler: any, rol?: string) =>
    ({
      getHandler: () => handler,
      getClass: () => class DummyClass {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: rol ? { rol } : undefined,
        }),
      }),
    } as any);

  describe('P1: Cierre de POST /api/auth/register', () => {
    it('el método register exige roles ADMINISTRADOR o SUPER_ADMINISTRADOR', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, AuthController.prototype.register);
      expect(roles).toEqual(['ADMINISTRADOR', 'SUPER_ADMINISTRADOR']);
    });

    it('el guard bloquea llamadas anónimas a register', () => {
      expect(guard.canActivate(contextGuard(AuthController.prototype.register))).toBe(false);
    });

    it('el guard bloquea llamadas de usuarios con rol OPERADOR o AUDITOR a register', () => {
      expect(guard.canActivate(contextGuard(AuthController.prototype.register, 'OPERADOR_FAM'))).toBe(false);
      expect(guard.canActivate(contextGuard(AuthController.prototype.register, 'OPERADOR_PAGOS'))).toBe(false);
      expect(guard.canActivate(contextGuard(AuthController.prototype.register, 'AUDITOR'))).toBe(false);
    });

    it('el guard autoriza llamadas de ADMINISTRADOR y SUPER_ADMINISTRADOR a register', () => {
      expect(guard.canActivate(contextGuard(AuthController.prototype.register, 'ADMINISTRADOR'))).toBe(true);
      expect(guard.canActivate(contextGuard(AuthController.prototype.register, 'SUPER_ADMINISTRADOR'))).toBe(true);
    });
  });

  describe('P4: Protección de GET /api/roles', () => {
    it('el método findAll de RolesController exige roles ADMINISTRADOR o SUPER_ADMINISTRADOR', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, RolesController.prototype.findAll);
      expect(roles).toEqual(['ADMINISTRADOR', 'SUPER_ADMINISTRADOR']);
    });

    it('el guard bloquea llamadas de usuarios sin rol Admin a GET /api/roles', () => {
      expect(guard.canActivate(contextGuard(RolesController.prototype.findAll))).toBe(false);
      expect(guard.canActivate(contextGuard(RolesController.prototype.findAll, 'OPERADOR_PAGOS'))).toBe(false);
      expect(guard.canActivate(contextGuard(RolesController.prototype.findAll, 'OPERADOR_FAM'))).toBe(false);
      expect(guard.canActivate(contextGuard(RolesController.prototype.findAll, 'AUDITOR'))).toBe(false);
    });

    it('el guard autoriza a ADMINISTRADOR y SUPER_ADMINISTRADOR a listar roles', () => {
      expect(guard.canActivate(contextGuard(RolesController.prototype.findAll, 'ADMINISTRADOR'))).toBe(true);
      expect(guard.canActivate(contextGuard(RolesController.prototype.findAll, 'SUPER_ADMINISTRADOR'))).toBe(true);
    });
  });
});
