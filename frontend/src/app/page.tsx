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
    <div className="min-h-screen flex" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Panel izquierdo - Institucional */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between p-12"
        style={{ backgroundColor: '#3258CA' }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white text-xl font-bold">FAM</span>
            </div>
            <span className="text-white/90 text-lg font-medium">Fondo de Ayuda Mutua</span>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            Sistema de Fondo de Ayuda Mutua
          </h1>
          <p className="text-white/70 text-lg mt-6 leading-relaxed">
            Gestión de beneficios, pagos y servicios para los colegiados del colegio.
          </p>
        </div>

        <div className="text-white/50 text-sm">
          © {new Date().getFullYear()} — Sistema integral de gestión colegial
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#3258CA' }}>
              <span className="text-white text-xl font-bold">FAM</span>
            </div>
            <span className="text-lg font-semibold" style={{ color: '#1E293B' }}>
              Fondo de Ayuda Mutua
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#1E293B' }}>
            Iniciar Sesión
          </h2>
          <p className="text-sm mb-8" style={{ color: '#64748B' }}>
            Ingrese sus credenciales para acceder al sistema
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm border"
                style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
              >
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1E293B' }}>
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                placeholder="Ingrese su usuario"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1E293B' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                placeholder="Ingrese su contraseña"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#3258CA' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#2848A8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3258CA'; }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: '#E2E8F0' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>
              Usuarios de prueba
            </p>
            <div className="space-y-2">
              {[
                { user: 'admin', rol: 'Administrador' },
                { user: 'operador1', rol: 'Operador de Pagos' },
                { user: 'auditor1', rol: 'Auditor' },
              ].map((u) => (
                <button
                  key={u.user}
                  type="button"
                  onClick={() => { setUsername(u.user); setPassword('Admin123!'); setError(''); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors duration-150 text-left group"
                  style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3258CA33'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                >
                  <div>
                    <span className="text-sm font-medium group-hover:text-blue-700" style={{ color: '#1E293B' }}>
                      {u.user}
                    </span>
                    <span className="text-xs ml-2" style={{ color: '#64748B' }}>
                      {u.rol}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: '#64748B' }}>Click para llenar</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
