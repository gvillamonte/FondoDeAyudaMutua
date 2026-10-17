'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseJsonSafe } from '@/lib/safe-json';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await parseJsonSafe<{ error?: string; accessToken?: string; refreshToken?: string; usuario?: unknown }>(response);

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      if (!data.accessToken) {
        throw new Error('Respuesta invalida del servidor. Verifique que el backend este activo.');
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken || '');
      localStorage.setItem('user', JSON.stringify(data.usuario));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-layout">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">CIP</span>
            </div>
            <h1 className="text-xl font-semibold text-text-main">
              Sistema de Beneficios Colegiales
            </h1>
            <p className="text-text-sec text-sm mt-1">
              Ingrese sus credenciales para acceder
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-error text-error px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="label-field">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Ingrese su usuario"
                required
              />
            </div>

            <div>
              <label className="label-field">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Ingrese su contraseña"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-text-sec text-xs font-medium uppercase tracking-wider mb-3">
              Usuarios de prueba
            </p>
            <div className="space-y-2">
              {[
                { user: 'admin', pass: 'Admin123!', rol: 'Administrador' },
                { user: 'operador1', pass: 'Admin123!', rol: 'Operador de Pagos' },
                { user: 'auditor1', pass: 'Admin123!', rol: 'Auditor' },
              ].map((u) => (
                <button
                  key={u.user}
                  type="button"
                  onClick={() => { setUsername(u.user); setPassword(u.pass); setError(''); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-bg-layout hover:bg-blue-50 border border-border hover:border-primary/30 transition-colors text-left group"
                >
                  <div>
                    <span className="text-sm font-medium text-text-main group-hover:text-primary">{u.user}</span>
                    <span className="text-xs text-text-sec ml-2">{u.rol}</span>
                  </div>
                  <span className="text-xs text-text-sec">Click para llenar</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
