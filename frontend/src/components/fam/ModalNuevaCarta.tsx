'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface ModalNuevaCartaProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (carta: { id: string; numero: string; fecha: string | null; referencia: string | null }) => void;
}

export default function ModalNuevaCarta({ open, onClose, onSuccess }: ModalNuevaCartaProps) {
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleCerrar = () => {
    setError('');
    setNumero('');
    setReferencia('');
    onClose();
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTrim = numero.trim();
    if (!numTrim) {
      setError('El número de carta es obligatorio.');
      return;
    }

    try {
      setGuardando(true);
      setError('');
      const res = await api.post('/cartas', {
        numero: numTrim,
        fecha: fecha || undefined,
        referencia: referencia.trim() || undefined,
        activo: true,
      });

      const nueva = res.data;
      onSuccess(nueva);
      handleCerrar();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al registrar la carta.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#3258CA]/10 text-[#3258CA] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Registrar Nueva Carta</h3>
              <p className="text-xs text-text-sec">Se agregará al catálogo y se seleccionará automáticamente</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={guardando}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">
              N.° de Carta <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ej. CART-0123-2026"
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3258CA]/30 focus:border-[#3258CA]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">
              Fecha de Carta
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3258CA]/30 focus:border-[#3258CA]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">
              Referencia / Asunto
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. Remisión de expediente FAM a Gerencia"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3258CA]/30 focus:border-[#3258CA]"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCerrar}
              disabled={guardando}
              className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#3258CA] hover:bg-[#2846a2] rounded-lg inline-flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {guardando && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              Guardar y Seleccionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
