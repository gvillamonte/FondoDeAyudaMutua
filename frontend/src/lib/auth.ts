import api from './api';
import { User } from '@/types';

export async function login(username: string, password: string) {
  const response = await api.post('/auth/login', { username, password });
  const data = response.data;

  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.usuario));
  }

  return data;
}

export async function register(userData: {
  username: string;
  email: string;
  password: string;
  nombreCompleto: string;
  rol: string;
}) {
  const response = await api.post('/auth/register', userData);
  return response.data;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('accessToken');
}

export function hasRole(roles: string[]): boolean {
  const user = getCurrentUser();
  return user ? roles.includes(user.rol) : false;
}

export function hasModuleAccess(moduleKey: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.rol === 'ADMINISTRADOR' || user.rol === 'SUPER_ADMINISTRADOR') return true;
  if (user.rol === 'OPERADOR_FAM' && moduleKey === 'dashboard') return false;
  if (Array.isArray(user.modulos)) {
    return user.modulos.includes(moduleKey);
  }
  return true;
}

export type AuthAction = 'create' | 'read' | 'edit' | 'delete' | 'export' | 'anular';

export function can(action: AuthAction, resource?: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;

  // Superadministrador y Administrador tienen acceso total a todas las acciones
  if (user.rol === 'ADMINISTRADOR' || user.rol === 'SUPER_ADMINISTRADOR') {
    return true;
  }

  // Si se especifica un recurso (módulo), primero debe tener acceso al módulo
  if (resource && !hasModuleAccess(resource)) {
    return false;
  }

  // Rol AUDITOR: Solo lectura y exportación
  if (user.rol === 'AUDITOR') {
    return action === 'read' || action === 'export';
  }

  // Acciones destructivas (eliminar/anular): solo Administradores o Jefes/Supervisores
  if (action === 'delete' || action === 'anular') {
    return user.rol === 'SUPERVISOR_FAM' || user.rol === 'JEFE_FAM';
  }

  // Acciones de creación, edición y consulta para usuarios operativos autorizados
  if (action === 'create' || action === 'edit' || action === 'read' || action === 'export') {
    return true;
  }

  return false;
}

export async function refreshCurrentUser(): Promise<User | null> {
  try {
    const response = await api.get('/auth/me');
    if (response.data) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    }
  } catch {}
  return getCurrentUser();
}
