import { describe, it, expect, beforeEach } from 'vitest';
import { hasModuleAccess, getCurrentUser } from '../src/lib/auth';

describe('Acceso de Módulos - OPERADOR_FAM', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('OPERADOR_FAM no tiene acceso al módulo dashboard', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u-operador-fam',
        username: 'operador_fam',
        rol: 'OPERADOR_FAM',
        modulos: ['fam', 'beneficios', 'colegiados', 'reportes'],
      }),
    );

    expect(hasModuleAccess('dashboard')).toBe(false);
  });

  it('OPERADOR_FAM tiene acceso directo a sus módulos correspondientes', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u-operador-fam',
        username: 'operador_fam',
        rol: 'OPERADOR_FAM',
        modulos: ['fam', 'beneficios', 'colegiados', 'reportes'],
      }),
    );

    expect(hasModuleAccess('fam')).toBe(true);
    expect(hasModuleAccess('beneficios')).toBe(true);
    expect(hasModuleAccess('colegiados')).toBe(true);
    expect(hasModuleAccess('reportes')).toBe(true);
    expect(hasModuleAccess('pagos')).toBe(false);
    expect(hasModuleAccess('caja')).toBe(false);
    expect(hasModuleAccess('usuarios')).toBe(false);
  });

  it('ADMINISTRADOR mantiene acceso a todos los módulos incluido dashboard', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u-admin',
        username: 'admin',
        rol: 'ADMINISTRADOR',
      }),
    );

    expect(hasModuleAccess('dashboard')).toBe(true);
    expect(hasModuleAccess('fam')).toBe(true);
  });
});
