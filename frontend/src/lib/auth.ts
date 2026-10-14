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
