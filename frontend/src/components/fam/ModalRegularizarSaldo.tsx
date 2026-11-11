'use client';

import { useState } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface BeneficiarioNuevo {
  key: string;
  nombre: string;
  dni: string;
  parentesco: string;
  monto: string;
  porcentaje: string;
  declaracionJurada?: string;
  declaracionJuradaDni?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expedienteId: string;
  expedienteNumero?: string | null;
  colegiadoNombre?: string | null;
  montoTotalAsignado?: number;
  saldoPendiente?: number;
  montoMinimoNormativo?: number;
}

const PARENTESCO_OPTIONS = [
  'Hijo(a)',
  'Cónyuge',
  'Conviviente',
  'Madre',
  'Padre',
  'Hermano(a)',
  'Sobrino(a)',
  'Tío(a)',
  'Nieto(a)',
  'Otros',
];

export default function ModalRegularizarSaldo({
  isOpen,
  onClose,
  onSuccess,
  expedienteId,
  expedienteNumero,
  colegiadoNombre,
  montoTotalAsignado = 0,
  saldoPendiente = 0,
  montoMinimoNormativo = 3000,
}: Props) {
  const [modo, setModo] = useState<'beneficiario' | 'monto'>('beneficiario');
  const [montoAdicional, setMontoAdicional] = useState(saldoPendiente > 0 ? String(saldoPendiente) : '');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [nuevosBeneficiarios, setNuevosBeneficiarios] = useState<BeneficiarioNuevo[]>([
    {
      key: 'ben-1',
      nombre: '',
      dni: '',
      parentesco: 'Hijo(a)',
      monto: saldoPendiente > 0 ? String(saldoPendiente) : '',
      porcentaje: '0',
    },
  ]);

  const fmt = (n: number) =>
    `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const agregarFilaBeneficiario = () => {
    setNuevosBeneficiarios((prev) => [
      ...prev,
      {
        key: `ben-${Date.now()}`,
        nombre: '',
        dni: '',
        parentesco: 'Hijo(a)',
        monto: '',
        porcentaje: '0',
      },
    ]);
  };

  const quitarFilaBeneficiario = (key: string) => {
    setNuevosBeneficiarios((prev) => prev.filter((b) => b.key !== key));
  };

  const handleSubirPdf = (key: string, file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setNuevosBeneficiarios((prev) =>
        prev.map((b) => (b.key === key ? { ...b, declaracionJurada: base64 } : b))
      );
    };
    reader.readAsDataURL(file);
  };

  const guardarRegularizacion = async () => {
    setError('');
    setGuardando(true);

    try {
      const payload: any = {
        observaciones: observaciones.trim() || undefined,
        motivo: 'Regularización de saldo pendiente por normativa de fallecimiento',
      };

      if (modo === 'monto') {
        const adic = parseFloat(montoAdicional);
        if (isNaN(adic) || adic <= 0) {
          setError('Ingrese un monto adicional válido (> 0)');
          setGuardando(false);
          return;
        }
        payload.montoAdicional = adic;
      } else {
        if (nuevosBeneficiarios.length === 0) {
          setError('Debe registrar al menos un beneficiario para regularizar');
          setGuardando(false);
          return;
        }
        for (const b of nuevosBeneficiarios) {
          if (!b.nombre.trim()) {
            setError('Todos los beneficiarios agregados deben tener nombre completo');
            setGuardando(false);
            return;
          }
          const m = parseFloat(b.monto);
          if (isNaN(m) || m <= 0) {
            setError(`El beneficiario ${b.nombre} debe tener un monto válido (> 0)`);
            setGuardando(false);
            return;
          }
        }

        payload.beneficiarios = nuevosBeneficiarios.map((b) => ({
          nombre: b.nombre.trim(),
          dni: b.dni.trim() || undefined,
          parentesco: b.parentesco,
          monto: parseFloat(b.monto) || 0,
          porcentaje: parseFloat(b.porcentaje) || 0,
          declaracionJurada: b.declaracionJurada || undefined,
          declaracionJuradaDni: b.declaracionJuradaDni?.trim() || b.dni.trim() || undefined,
        }));
      }

      await api.post(`/fam-beneficios/${expedienteId}/regularizar-saldo`, payload);
      showConfirmMessage(
        'success',
        'Regularización guardada con éxito',
        'El saldo pendiente ha sido recalculado y auditado correctamente.'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al regularizar saldo';
      setError(msg);
      showConfirmMessage('error', 'Error en la regularización', msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Regularización de Saldo Pendiente"
      onConfirm={guardarRegularizacion}
      confirmText="Guardar Regularización"
      cancelText="Cancelar"
      confirmVariant="primary"
      loading={guardando}
    >
      <div className="space-y-4 text-xs sm:text-sm">
        {/* Banner de estado */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
          <p className="font-semibold text-xs uppercase tracking-wide text-blue-800">
            {expedienteNumero ? `Expediente: ${expedienteNumero}` : 'Expediente FAM'}
            {colegiadoNombre ? ` — ${colegiadoNombre}` : ''}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-blue-200/60 text-xs">
            <div>
              <span className="text-blue-700 block">Monto actual:</span>
              <span className="font-semibold">{fmt(montoTotalAsignado)}</span>
            </div>
            <div>
              <span className="text-blue-700 block">Monto mínimo:</span>
              <span className="font-semibold">{fmt(montoMinimoNormativo)}</span>
            </div>
            <div>
              <span className="text-amber-800 block">Saldo faltante:</span>
              <span className="font-bold text-amber-700">{fmt(saldoPendiente)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-medium">
            {error}
          </div>
        )}

        {/* Selector de modo */}
        <div className="flex gap-2 border-b border-border-main pb-2">
          <button
            type="button"
            onClick={() => setModo('beneficiario')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              modo === 'beneficiario'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-sec hover:bg-gray-200'
            }`}
          >
            Agregar Beneficiario(s)
          </button>
          <button
            type="button"
            onClick={() => setModo('monto')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              modo === 'monto'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-sec hover:bg-gray-200'
            }`}
          >
            Ajustar Monto Adicional
          </button>
        </div>

        {modo === 'beneficiario' ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-text-sec uppercase">
                Beneficiarios a incorporar
              </span>
              <button
                type="button"
                onClick={agregarFilaBeneficiario}
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                + Añadir otro beneficiario
              </button>
            </div>

            {nuevosBeneficiarios.map((b, idx) => (
              <div
                key={b.key}
                className="p-3 bg-bg-layout border border-border-main rounded-lg space-y-2 relative"
              >
                {nuevosBeneficiarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarFilaBeneficiario(b.key)}
                    className="absolute top-2 right-2 text-xs text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Nombres y apellidos"
                      value={b.nombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNuevosBeneficiarios((prev) =>
                          prev.map((item) => (item.key === b.key ? { ...item, nombre: val } : item))
                        );
                      }}
                      className="w-full px-2 py-1 text-xs border border-border-main rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      DNI (8 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="DNI"
                      value={b.dni}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setNuevosBeneficiarios((prev) =>
                          prev.map((item) =>
                            item.key === b.key ? { ...item, dni: val, declaracionJuradaDni: val } : item
                          )
                        );
                      }}
                      className="w-full px-2 py-1 text-xs border border-border-main rounded bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Parentesco
                    </label>
                    <select
                      value={b.parentesco}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNuevosBeneficiarios((prev) =>
                          prev.map((item) => (item.key === b.key ? { ...item, parentesco: val } : item))
                        );
                      }}
                      className="w-full px-2 py-1 text-xs border border-border-main rounded bg-white"
                    >
                      {PARENTESCO_OPTIONS.map((opc) => (
                        <option key={opc} value={opc}>
                          {opc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Monto asignado (S/) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      value={b.monto}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNuevosBeneficiarios((prev) =>
                          prev.map((item) => (item.key === b.key ? { ...item, monto: val } : item))
                        );
                      }}
                      className="w-full px-2 py-1 text-xs font-semibold text-green-700 border border-border-main rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Declaración Jurada (PDF)
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      {b.declaracionJurada ? '✓ PDF adjunto' : '+ Subir PDF'}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleSubirPdf(b.key, e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 p-3 bg-bg-layout border border-border-main rounded-lg">
            <label className="block text-xs font-semibold text-text-sec uppercase">
              Monto adicional a regularizar (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={montoAdicional}
              onChange={(e) => setMontoAdicional(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold text-green-700 border border-border-main rounded bg-white"
              placeholder="0.00"
            />
            <p className="text-[11px] text-text-sec">
              El monto ingresado se sumará al expediente actual para cubrir el saldo pendiente.
            </p>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-semibold text-text-sec uppercase mb-1">
            Observaciones o Justificación de Regularización
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Detalles de la regularización, documentación presentada o resolución..."
            className="w-full px-2.5 py-1.5 text-xs border border-border-main rounded bg-white"
          />
        </div>
      </div>
    </Modal>
  );
}

