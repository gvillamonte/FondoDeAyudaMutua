'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseJsonSafe } from '@/lib/safe-json';
import ConfirmCenterMessage, { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const targetUrl = '/api/auth/login';

    try {
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
      } catch (fetchErr: any) {
        showConfirmMessage('error', 'Su contraseña ha sido incorrecta.');
        return;
      }

      let data: any;
      try {
        data = await parseJsonSafe<{
          error?: string;
          message?: string;
          accessToken?: string;
          refreshToken?: string;
          usuario?: unknown;
        }>(response);
      } catch (parseErr: any) {
        showConfirmMessage('error', 'Su contraseña ha sido incorrecta.');
        return;
      }

      if (!response.ok || !data?.accessToken) {
        showConfirmMessage('error', 'Su contraseña ha sido incorrecta.');
        return;
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken || '');
      localStorage.setItem('user', JSON.stringify(data.usuario));
      router.push('/dashboard');
    } catch (err: any) {
      showConfirmMessage('error', 'Su contraseña ha sido incorrecta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F8FAFC' }}>
      <ConfirmCenterMessage />

      {/* Panel izquierdo - Institucional */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between p-12 border-r-4 border-amber-500/50"
        style={{ backgroundColor: '#8f0404' }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center shadow-md">
              <span className="text-[#8f0404] text-xl font-black">CIP</span>
            </div>
            <div>
              <span className="text-white text-lg font-bold block leading-tight">Colegio de Ingenieros del Perú</span>
              <span className="text-amber-300 text-xs font-semibold tracking-wider uppercase block">Consejo Departamental</span>
            </div>
          </div>
        </div>

        <div className="max-w-lg">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-4 border border-amber-400/30">
            Plataforma Institucional
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            Sistema ERP - Colegio de Ingenieros
          </h1>
          <p className="text-white/80 text-lg mt-6 leading-relaxed">
            Plataforma centralizada para la gestión de colegiados, caja, aportaciones, tesorería y beneficios institucionales.
          </p>
        </div>

        <div className="text-amber-200/60 text-sm">
          © {new Date().getFullYear()} — Colegio de Ingenieros del Perú. Todos los derechos reservados.
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center shadow-md">
              <span className="text-[#8f0404] text-xl font-black">CIP</span>
            </div>
            <div>
              <span className="text-lg font-bold block" style={{ color: '#8f0404' }}>
                Sistema ERP
              </span>
              <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider block">
                Colegio de Ingenieros
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#1E293B' }}>
            Iniciar Sesión
          </h2>
          <p className="text-sm mb-8" style={{ color: '#64748B' }}>
            Ingrese sus credenciales autorizadas para acceder al sistema ERP
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1E293B' }}>
                Usuario o Correo Institucional
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                placeholder="Ingrese su usuario o correo"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1E293B' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-2.5 rounded-lg border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  placeholder="Ingrese su contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm bg-[#8f0404] hover:bg-[#730202]"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    width="16"
                    height="16"
                    style={{ width: '16px', height: '16px' }}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando...
                </>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>

          {/* Acceso Directo Colegiados - Actualización de Datos */}
          <div
            className="mt-6 p-4 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: '#8f0404', color: '#FFFFFF' }}
              >
                <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold" style={{ color: '#78350F' }}>
                  ¿Eres Colegiado del CIP?
                </h3>
                <p className="text-xs mt-0.5 text-amber-900/80">
                  Ingresa tu CIP y DNI para consultar tu estado de habilidad y actualizar tus datos personales.
                </p>
                <Link
                  href="/actualizar-datos"
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors duration-150 bg-[#8f0404] hover:bg-[#730202]"
                >
                  <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Portal Colegiado Aquí</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
