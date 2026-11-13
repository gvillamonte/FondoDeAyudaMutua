'use client';

import { useState, useEffect } from 'react';
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
  const [montoAdicional, setMontoAdicional] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const calcularPct = (montoNum: number) => {
    if (montoMinimoNormativo <= 0 || montoNum <= 0) return '0.00';
    return Number(((montoNum / montoMinimoNormativo) * 100).toFixed(2)).toString();
  };

  const calcularMonto = (pctNum: number) => {
    if (montoMinimoNormativo <= 0 || pctNum <= 0) return '0.00';
    return Number(((pctNum / 100) * montoMinimoNormativo).toFixed(2)).toString();
  };

  const [nuevosBeneficiarios, setNuevosBeneficiarios] = useState<BeneficiarioNuevo[]>([]);

  // Sincronizar y rellenar automáticamente con el saldo exacto al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setError('');
      setObservaciones('');
      const saldo = Math.max(0, Number(saldoPendiente || 0));
      setMontoAdicional(saldo > 0 ? saldo.toFixed(2) : '');
      const pctExacto = calcularPct(saldo);
      setNuevosBeneficiarios([
        {
          key: `ben-${Date.now()}`,
          nombre: '',
          dni: '',
          parentesco: 'Hijo(a)',
          monto: saldo > 0 ? saldo.toFixed(2) : '',
          porcentaje: saldo > 0 ? pctExacto : '',
        },
      ]);
    }
  }, [isOpen, saldoPendiente, montoMinimoNormativo]);

  const fmt = (n: number) =>
    `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalAsignadoEnModal = nuevosBeneficiarios.reduce(
    (acc, b) => acc + (parseFloat(b.monto) || 0),
    0,
  );
  const saldoFaltanteEnModal = Math.max(0, Number((saldoPendiente - totalAsignadoEnModal).toFixed(2)));

  const cambiarMontoBeneficiario = (key: string, val: string) => {
    const m = Math.max(0, parseFloat(val) || 0);
    const pct = calcularPct(m);
    setNuevosBeneficiarios((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, monto: val, porcentaje: m > 0 ? pct : '' } : item,
      ),
    );
  };

  const cambiarPorcentajeBeneficiario = (key: string, val: string) => {
    const p = Math.max(0, Math.min(100, parseFloat(val) || 0));
    const m = calcularMonto(p);
    setNuevosBeneficiarios((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, porcentaje: val, monto: p > 0 ? m : '' } : item,
      ),
    );
  };

  // Botón para autocompletar al monto exacto del saldo pendiente
  const completarMontoExactoFila = (key: string) => {
    const otrosSuma = nuevosBeneficiarios
      .filter((x) => x.key !== key)
      .reduce((acc, x) => acc + (parseFloat(x.monto) || 0), 0);
    const faltante = Math.max(0, Number((saldoPendiente - otrosSuma).toFixed(2)));
    const pct = calcularPct(faltante);

    setNuevosBeneficiarios((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              monto: faltante > 0 ? faltante.toFixed(2) : '',
              porcentaje: faltante > 0 ? pct : '',
            }
          : item,
      ),
    );

    showConfirmMessage(
      'info',
      'Monto exacto completado',
      `Asignado S/ ${faltante.toFixed(2)} (${pct}%) automáticamente para cubrir el saldo exacto`,
    );
  };

  const agregarFilaBeneficiario = () => {
    const actualSum = nuevosBeneficiarios.reduce(
      (acc, b) => acc + (parseFloat(b.monto) || 0),
      0,
    );
    const restante = Math.max(0, Number((saldoPendiente - actualSum).toFixed(2)));
    const pctRestante = calcularPct(restante);

    setNuevosBeneficiarios((prev) => [
      ...prev,
      {
        key: `ben-${Date.now()}`,
        nombre: '',
        dni: '',
        parentesco: 'Hijo(a)',
        monto: restante > 0 ? restante.toFixed(2) : '',
        porcentaje: restante > 0 ? pctRestante : '',
      },
    ]);
  };

  const quitarFilaBeneficiario = (key: string) => {
    if (nuevosBeneficiarios.length <= 1) {
      showConfirmMessage('warning', 'Mínimo requerido', 'Debe mantenerse al menos un beneficiario para regularizar');
      return;
    }
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
      showConfirmMessage('success', 'PDF adjunto', 'Declaración jurada cargada correctamente');
    };
    reader.readAsDataURL(file);
  };

  const guardarRegularizacion = async () => {
    setError('');

    if (modo === 'monto') {
      const adic = parseFloat(montoAdicional);
      if (isNaN(adic) || adic <= 0) {
        const msg = 'Ingrese un monto adicional válido mayor a S/ 0';
        setError(msg);
        showConfirmMessage('warning', 'Monto adicional requerido', msg);
        return;
      }
    } else {
      if (nuevosBeneficiarios.length === 0) {
        const msg = 'Debe registrar al menos un beneficiario para regularizar';
        setError(msg);
        showConfirmMessage('warning', 'Beneficiario requerido', msg);
        return;
      }
      for (let i = 0; i < nuevosBeneficiarios.length; i++) {
        const b = nuevosBeneficiarios[i];
        if (!b.nombre.trim()) {
          const msg = `El beneficiario #${i + 1} debe tener nombre completo`;
          setError(msg);
          showConfirmMessage('warning', 'Nombre requerido', msg);
          return;
        }
        const m = parseFloat(b.monto);
        if (isNaN(m) || m <= 0) {
          const msg = `El beneficiario ${b.nombre} debe tener un monto válido mayor a S/ 0 (no puede quedar en cero)`;
          setError(msg);
          showConfirmMessage('warning', 'Monto en cero', msg);
          return;
        }
        const p = parseFloat(b.porcentaje);
        if (isNaN(p) || p <= 0) {
          const msg = `El beneficiario ${b.nombre} debe tener un porcentaje válido mayor a 0% (no puede quedar en cero)`;
          setError(msg);
          showConfirmMessage('warning', 'Porcentaje en cero', msg);
          return;
        }
      }
    }

    setGuardando(true);

    try {
      const payload: any = {
        observaciones: observaciones.trim() || undefined,
        motivo: 'Regularización de saldo pendiente por normativa de fallecimiento',
      };

      if (modo === 'monto') {
        payload.montoAdicional = parseFloat(montoAdicional);
      } else {
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
        'El saldo pendiente ha sido recalculado y registrado en la auditoría.',
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
                ? 'bg-primary text-white font-semibold'
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
                ? 'bg-primary text-white font-semibold'
                : 'bg-gray-100 text-text-sec hover:bg-gray-200'
            }`}
          >
            Ajustar Monto Adicional
          </button>
        </div>

        {modo === 'beneficiario' ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-xs font-semibold text-text-sec uppercase">
                Beneficiarios a incorporar
              </span>
              <div className="flex items-center gap-2">
                {saldoFaltanteEnModal > 0 && nuevosBeneficiarios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => completarMontoExactoFila(nuevosBeneficiarios[nuevosBeneficiarios.length - 1].key)}
                    className="px-2.5 py-1 text-xs font-semibold text-[#3258CA] bg-blue-50 border border-[#3258CA]/40 rounded hover:bg-blue-100 transition-colors inline-flex items-center gap-1 shadow-2xs"
                    title="Asignar el saldo restante exacto al último beneficiario"
                  >
                    ⚡ Completar saldo exacto (S/ {saldoFaltanteEnModal.toFixed(2)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={agregarFilaBeneficiario}
                  className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"
                >
                  + Añadir otro beneficiario
                </button>
              </div>
            </div>

            {nuevosBeneficiarios.map((b, idx) => (
              <div
                key={b.key}
                className="p-3 bg-bg-layout border border-border-main rounded-lg space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-main uppercase">
                    Beneficiario #{idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => completarMontoExactoFila(b.key)}
                      className="text-[10px] text-primary font-bold hover:underline bg-white px-2 py-0.5 rounded border border-primary/30"
                      title="Calcular y asignar el saldo faltante exacto a esta fila"
                    >
                      ⚡ Completar al monto exacto
                    </button>
                    {nuevosBeneficiarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitarFilaBeneficiario(b.key)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Nombres y apellidos completos"
                      value={b.nombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNuevosBeneficiarios((prev) =>
                          prev.map((item) => (item.key === b.key ? { ...item, nombre: val } : item))
                        );
                      }}
                      className="w-full px-2 py-1 text-xs border border-border-main rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
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
                      className="w-full px-2 py-1 text-xs border border-border-main rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
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
                      className="w-full px-2 py-1 text-xs border border-border-main rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
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
                      Monto (S/) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-1.5 top-1 text-[11px] text-text-sec font-medium">S/</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        placeholder="0.00"
                        value={b.monto}
                        onChange={(e) => cambiarMontoBeneficiario(b.key, e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs font-bold text-green-700 border border-border-main rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      % Asignado *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        max={100}
                        placeholder="0.00"
                        value={b.porcentaje}
                        onChange={(e) => cambiarPorcentajeBeneficiario(b.key, e.target.value)}
                        className="w-full pl-2 pr-5 py-1 text-xs font-bold text-primary border border-border-main rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-1.5 top-1 text-[11px] text-text-sec font-medium">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Declaración Jurada (PDF)
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
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

            <div className="flex justify-between items-center text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-text-sec">
                Total a incorporar en regularización: <strong className="text-text-main font-bold">{fmt(totalAsignadoEnModal)}</strong>
              </span>
              <span className={`font-bold ${saldoFaltanteEnModal === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                {saldoFaltanteEnModal === 0
                  ? '✓ Cubre el saldo pendiente exacto'
                  : `Resta por cubrir: ${fmt(saldoFaltanteEnModal)}`}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-3 bg-bg-layout border border-border-main rounded-lg">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-text-sec uppercase">
                Monto adicional a regularizar (S/) *
              </label>
              {saldoPendiente > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMontoAdicional(Number(saldoPendiente).toFixed(2));
                    showConfirmMessage('info', 'Monto rellenado', `Monto fijado en S/ ${Number(saldoPendiente).toFixed(2)}`);
                  }}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  ⚡ Rellenar saldo exacto (S/ {Number(saldoPendiente).toFixed(2)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-sm text-text-sec font-semibold">S/</span>
              <input
                type="number"
                step="0.01"
                min={0.01}
                value={montoAdicional}
                onChange={(e) => setMontoAdicional(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm font-bold text-green-700 border border-border-main rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0.00"
              />
            </div>
            <p className="text-[11px] text-text-sec">
              El monto ingresado se sumará al expediente actual para cubrir el saldo pendiente normativo.
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
            className="w-full px-2.5 py-1.5 text-xs border border-border-main rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </Modal>
  );
}
