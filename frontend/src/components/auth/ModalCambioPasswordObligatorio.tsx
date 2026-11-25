'use client';

import { useState, useMemo } from 'react';
import api from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function ModalCambioPasswordObligatorio({ isOpen, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      setErrorMsg('Por favor asegúrese de cumplir todos los requisitos de seguridad');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await api.patch('/auth/cambiar-password-obligatorio', { password });

      // Actualizar usuario en localStorage
      const u = getCurrentUser();
      if (u) {
        localStorage.setItem(
          'user',
          JSON.stringify({ ...u, debeCambiarPassword: false }),
        );
      }

      showConfirmMessage(
        'success',
        'Contraseña Actualizada',
        'Su contraseña personal ha sido establecida exitosamente. Bienvenido al sistema.',
      );
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Cabecera institucional */}
        <div className="bg-[#8f0404] p-5 text-center text-white">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2.5 border border-white/20">
            <span className="text-2xl">🔐</span>
          </div>
          <h3 className="text-lg font-bold tracking-tight">Cambio de Contraseña Obligatorio</h3>
          <p className="text-xs text-amber-200 font-medium mt-0.5 uppercase tracking-wider">
            Colegio de Ingenieros del Perú — CD Cusco
          </p>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
            <p className="font-semibold mb-0.5">⚠️ Primer Ingreso al Sistema</p>
            Al haber ingresado con la clave temporal por defecto (<strong>123456</strong>), es indispensable que establezca una nueva contraseña personal y segura antes de continuar.
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
              {errorMsg}
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
                placeholder="Ingrese su nueva clave"
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

          {/* Checklist de requisitos */}
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
            {password && (
              <div className={`pt-1.5 border-t border-slate-200 text-[11px] font-medium flex items-center gap-1.5 ${validation.isDifferentFromDefault ? 'text-emerald-600' : 'text-red-600'}`}>
                <span>{validation.isDifferentFromDefault ? '✓' : '✕'}</span>
                <span>Diferente de la contraseña temporal (123456)</span>
              </div>
            )}
            {confirmPassword && (
              <div className={`pt-1 border-t border-slate-200 text-[11px] font-medium flex items-center gap-1.5 ${validation.matchesConfirm ? 'text-emerald-600' : 'text-red-600'}`}>
                <span>{validation.matchesConfirm ? '✓' : '✕'}</span>
                <span>{validation.matchesConfirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !validation.isValid}
              className="w-full py-2.5 px-4 bg-[#8f0404] hover:bg-[#730202] text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando contraseña...' : 'Guardar Nueva Contraseña y Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
