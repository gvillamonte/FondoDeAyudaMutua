'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function RecuperarPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [verificando, setVerificando] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [usuarioData, setUsuarioData] = useState<{ username?: string; emailMasked?: string }>({});

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [guardarError, setGuardarError] = useState('');

  // Validar token al cargar
  useEffect(() => {
    if (!token) {
      setVerificando(false);
      setTokenValido(false);
      setTokenError('No se proporcionó ningún token de recuperación en el enlace.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/recuperar-password/verificar?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.valid) {
          setTokenValido(true);
          setUsuarioData({ username: data.username, emailMasked: data.emailMasked });
        } else {
          setTokenValido(false);
          setTokenError(data.message || 'El enlace de recuperación es inválido o ha expirado.');
        }
      } catch (err: any) {
        setTokenValido(false);
        setTokenError('No se pudo verificar el enlace con el servidor.');
      } finally {
        setVerificando(false);
      }
    })();
  }, [token]);

  const validation = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
    const matchesConfirm = Boolean(password && confirmPassword && password === confirmPassword);
    const isDifferentFromDefault = password !== '123456';
    const isValid =
      hasMinLength && hasLetter && hasNumber && hasSymbol && matchesConfirm && isDifferentFromDefault;

    return {
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSymbol,
      matchesConfirm,
      isDifferentFromDefault,
      isValid,
    };
  }, [password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      setGuardarError('La contraseña debe cumplir con todos los requisitos de seguridad');
      return;
    }

    setGuardando(true);
    setGuardarError('');

    try {
      const res = await fetch('/api/auth/recuperar-password/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al restablecer la contraseña');
      }
      setCompletado(true);
    } catch (err: any) {
      setGuardarError(err?.message || 'Error al comunicarse con el servidor');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Cabecera CIP Cusco */}
        <div className="bg-[#8f0404] p-6 text-center text-white">
          <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <span className="text-2xl font-black text-[#8f0404]">CIP</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Recuperación de Contraseña</h1>
          <p className="text-xs text-amber-200 uppercase tracking-wider font-semibold mt-0.5">
            Colegio de Ingenieros del Perú — CD Cusco
          </p>
        </div>

        <div className="p-6">
          {verificando ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-[#8f0404] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">Verificando enlace de seguridad...</p>
            </div>
          ) : !tokenValido ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                ✕
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Enlace No Válido o Expirado</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {tokenError || 'Este enlace de recuperación ha caducado o ya fue utilizado.'}
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-block w-full py-2.5 px-4 bg-[#8f0404] hover:bg-[#730202] text-white text-sm font-semibold rounded-lg transition-colors text-center shadow-sm"
                >
                  Volver al Inicio de Sesión
                </Link>
              </div>
            </div>
          ) : completado ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">¡Contraseña Restablecida!</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Su contraseña ha sido actualizada con éxito. A partir de ahora puede iniciar sesión con su nueva clave.
                </p>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full py-2.5 px-4 bg-[#8f0404] hover:bg-[#730202] text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                >
                  Iniciar Sesión Ahora
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {usuarioData.username && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Usuario:</span>
                    <span className="font-bold text-slate-800 font-mono">{usuarioData.username}</span>
                  </div>
                  {usuarioData.emailMasked && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Correo:</span>
                      <span className="font-medium text-slate-700">{usuarioData.emailMasked}</span>
                    </div>
                  )}
                </div>
              )}

              {guardarError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                  {guardarError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#8f0404] focus:ring-1 focus:ring-[#8f0404]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1 py-0.5"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita su nueva clave"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#8f0404] focus:ring-1 focus:ring-[#8f0404]"
                />
              </div>

              {/* Checklist */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1.5">
                <p className="font-semibold text-slate-800">Requisitos obligatorios:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${validation.hasMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                    <span>{validation.hasMinLength ? '✓' : '○'}</span>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${validation.hasLetter ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                    <span>{validation.hasLetter ? '✓' : '○'}</span>
                    <span>Al menos una letra</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${validation.hasNumber ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                    <span>{validation.hasNumber ? '✓' : '○'}</span>
                    <span>Al menos un número</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${validation.hasSymbol ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                    <span>{validation.hasSymbol ? '✓' : '○'}</span>
                    <span>Un símbolo (!@#$...)</span>
                  </div>
                </div>
                {confirmPassword && (
                  <div className={`pt-1.5 border-t border-slate-200 text-[11px] font-medium flex items-center gap-1.5 ${validation.matchesConfirm ? 'text-emerald-600' : 'text-red-600'}`}>
                    <span>{validation.matchesConfirm ? '✓' : '✕'}</span>
                    <span>{validation.matchesConfirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={guardando || !validation.isValid}
                  className="w-full py-2.5 px-4 bg-[#8f0404] hover:bg-[#730202] text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardando ? 'Guardando contraseña...' : 'Restablecer Contraseña'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecuperarPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-[#8f0404] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RecuperarPasswordContent />
    </Suspense>
  );
}
