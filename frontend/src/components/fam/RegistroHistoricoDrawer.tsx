'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface BeneficiarioVinculado {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
}

interface TipoBeneficioConfig {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface RegistroHistoricoProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  colegiadoId: string;
  colegiadoNombre: string;
  beneficiarios: BeneficiarioVinculado[];
  covidMontoTotal: number;
  historialBeneficios?: { tipo: string; monto: number; estado: string }[];
}

const DOCS_PDF = [
  { key: 'fichaAdmisibilidad', label: 'Ficha de Admisibilidad' },
  { key: 'solicitudAsignacion', label: 'Solicitud de Asignación' },
  { key: 'cartaRemision', label: 'Carta de Remisión' },
  { key: 'memorando', label: 'Memorándum' },
  { key: 'ordenPago', label: 'Orden de Pago' },
] as const;

type DocKey = (typeof DOCS_PDF)[number]['key'];

const MONTOS_BASE: Record<string, number> = {
  FALLECIMIENTO: 3000,
  ACC_GRAVE: 2000,
  ENF_TERMINAL: 2000,
};

export default function RegistroHistoricoDrawer({
  open, onClose, onSaved, colegiadoId, colegiadoNombre, beneficiarios, covidMontoTotal, historialBeneficios = [],
}: RegistroHistoricoProps) {
  const [tipos, setTipos] = useState<TipoBeneficioConfig[]>([]);
  const [catalogoCartas, setCatalogoCartas] = useState<any[]>([]);
  const [catalogoMemorandos, setCatalogoMemorandos] = useState<any[]>([]);

  const [tipoSeleccionado, setTipoSeleccionado] = useState('');
  const [monto, setMonto] = useState('');
  const [solicitanteId, setSolicitanteId] = useState(beneficiarios[0]?.id || '');
  const [observaciones, setObservaciones] = useState('');
  const [expedienteNumero, setExpedienteNumero] = useState('');
  const [fechaSolicitud, setFechaSolicitud] = useState(new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));

  const [cartaNumero, setCartaNumero] = useState('');
  const [cartaFecha, setCartaFecha] = useState('');
  const [memorandoNumero, setMemorandoNumero] = useState('');
  const [memorandoFecha, setMemorandoFecha] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [banco, setBanco] = useState('');

  const [docsPresentados, setDocsPresentados] = useState<Record<string, boolean>>({
    fichaAdmisibilidad: true,
    solicitudAsignacion: true,
    cartaRemision: true,
    memorando: true,
    ordenPago: true,
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/tipos-beneficio-config?activos=true').then(({ data }) => {
      const filtrados = data.filter((t: any) => {
        const nombre = (t.nombre || '').toUpperCase().trim();
        return nombre.includes('FALLECIMIENTO') || nombre.includes('ACCIDENTE') || nombre.includes('ENFERMEDAD') || nombre.includes('TERMINAL');
      });
      setTipos(filtrados);
    }).catch(() => {});
    api.get('/cartas').then(({ data }) => setCatalogoCartas(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/memorandos').then(({ data }) => setCatalogoMemorandos(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const docsPresentadosCount = Object.values(docsPresentados).filter(Boolean).length;
  const todosPresentados = docsPresentadosCount === DOCS_PDF.length;

  const calcularDescuento = () => {
    const tipo = tipos.find((t) => String(t.id) === String(tipoSeleccionado));
    const nombre = String(tipo?.nombre || '').toUpperCase();
    if (nombre.includes('ENFERMEDAD') || nombre.includes('TERMINAL')) {
      return covidMontoTotal;
    }
    return 0;
  };

  const descuento = calcularDescuento();
  const montoNumerico = parseFloat(monto) || 0;
  const montoFinal = Math.max(0, montoNumerico - descuento);

  const calcularMontoDisponible = () => {
    const tipo = tipos.find((t) => String(t.id) === String(tipoSeleccionado));
    const nombre = String(tipo?.nombre || '').toUpperCase();
    const esEnfTerminal = nombre.includes('ENFERMEDAD') || nombre.includes('TERMINAL');
    const esAccidente = nombre.includes('ACCIDENTE');
    const esFallecimiento = nombre.includes('FALLECIMIENTO');
    const cfgKey = esFallecimiento ? 'FALLECIMIENTO' : esAccidente ? 'ACC_GRAVE' : 'ENF_TERMINAL';
    const cfgBase = cfgKey === 'FALLECIMIENTO' ? 3000 : 2000;
    const pagado = historialBeneficios
      .filter((h) => h.tipo === cfgKey && (h.estado === 'PAGADA' || h.estado === 'APROBADA'))
      .reduce((sum, h) => sum + h.monto, 0);
    const descuentoCovid = esEnfTerminal ? covidMontoTotal : 0;
    return Math.max(0, cfgBase - descuentoCovid - pagado);
  };

  const validar = (): string => {
    if (!tipoSeleccionado) return 'Debe seleccionar un tipo de beneficio';
    if (!montoNumerico || montoNumerico <= 0) return 'Debe ingresar un monto válido';
    if (!fechaSolicitud) return 'Debe ingresar la fecha de recepción';
    const disponible = calcularMontoDisponible();
    if (disponible !== null && montoNumerico > disponible) {
      return `El monto S/ ${montoNumerico} excede el disponible (S/ ${disponible}) para este beneficio`;
    }
    return '';
  };

  const guardar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setError('');
    setGuardando(true);
    try {
      const solicitante = beneficiarios.find((b) => b.id === solicitanteId);
      const body: any = {
        colegiadoId,
        estado: 'PAGADA',
        beneficiarios: beneficiarios.map((b) => ({
          id: b.id,
          nombre: b.nombre,
          dni: b.dni || undefined,
          parentesco: b.parentesco,
          porcentaje: b.porcentajeAsignado,
        })),
        tipoBeneficioConfigId: Number(tipoSeleccionado),
        monto: montoNumerico,
        moneda: 'PEN',
        modalidadBeneficio: 'monto_compartido',
        fechaSolicitud,
        fechaPago: fechaPago || undefined,
        documentacionCompleta: todosPresentados,
        documentacionObservacion: !todosPresentados ? 'Documentación pendiente' : undefined,
        expedienteNumero: expedienteNumero.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        cartaNumero: cartaNumero || undefined,
        cartaFecha: cartaFecha || undefined,
        memorandoNumero: memorandoNumero || undefined,
        memorandoFecha: memorandoFecha || undefined,
        formaPago: formaPago || undefined,
        banco: banco || undefined,
        solicitanteBeneficiarioId: solicitanteId || undefined,
        solicitanteNombre: solicitante?.nombre || undefined,
        solicitanteDni: solicitante?.dni || undefined,
      };

      await api.post('/fam-registros', body);
      showConfirmMessage('success', 'Beneficio histórico registrado correctamente');
      onSaved();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Error al registrar';
      setError(msg);
      showConfirmMessage('error', msg);
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-[560px] max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold text-text-main">Registrar Beneficio Histórico</h3>
            <p className="text-sm text-text-sec">{colegiadoNombre} — Se guardará como PAGADA</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* 1. SOLICITUD DE BENEFICIO — Resumen de disponibles */}
          <section className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Solicitud de Beneficio — Disponibles
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {(['Fallecimiento', 'Accidente Grave', 'Enfermedad Terminal'] as const).map((nombre) => {
                const configs: Record<string, { base: number; key: string }> = {
                  'Fallecimiento': { base: 3000, key: 'FALLECIMIENTO' },
                  'Accidente Grave': { base: 2000, key: 'ACC_GRAVE' },
                  'Enfermedad Terminal': { base: 2000, key: 'ENF_TERMINAL' },
                };
                const cfg = configs[nombre];
                const esEnfTerminal = nombre === 'Enfermedad Terminal';
                const pagado = historialBeneficios
                  .filter((h) => h.tipo === cfg.key && (h.estado === 'PAGADA' || h.estado === 'APROBADA'))
                  .reduce((sum, h) => sum + h.monto, 0);
                const descuento = esEnfTerminal ? covidMontoTotal : 0;
                const disponible = Math.max(0, cfg.base - descuento - pagado);
                const agotado = disponible <= 0;
                return (
                  <div key={nombre} className={`p-3 rounded-lg border ${agotado ? 'border-gray-200 bg-gray-100 opacity-60' : 'border-green-200 bg-green-50'}`}>
                    <p className="text-xs font-semibold text-text-main">{nombre}</p>
                    <p className="text-xs text-text-sec mt-1">Base: S/ {cfg.base.toLocaleString()}</p>
                    {pagado > 0 && <p className="text-xs text-amber-600">Pagado: S/ {pagado.toLocaleString()}</p>}
                    {descuento > 0 && <p className="text-xs text-red-600">COVID: -S/ {descuento.toLocaleString()}</p>}
                    <p className={`text-sm font-bold mt-1 ${agotado ? 'text-gray-500' : 'text-green-700'}`}>
                      Disponible: S/ {disponible.toLocaleString()}
                    </p>
                    {agotado && <p className="text-[10px] text-red-500 font-medium">AGOTADO</p>}
                  </div>
                );
              })}
            </div>
            {covidMontoTotal > 0 && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                COVID-19 recibido: S/ {covidMontoTotal.toLocaleString()} — Se descuenta de Enfermedad Terminal
              </p>
            )}
          </section>

          {/* 2. Tipo de beneficio a registrar */}
          <section>
            <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Tipo de Beneficio a Registrar *</label>
            <div className="grid grid-cols-3 gap-3">
              {tipos.map((t) => {
                const seleccionado = String(tipoSeleccionado) === String(t.id);
                const nombreUpper = (t.nombre || '').toUpperCase().trim();
                const esEnfTerminal = nombreUpper.includes('ENFERMEDAD') || nombreUpper.includes('TERMINAL');
                const esAccidente = nombreUpper.includes('ACCIDENTE');
                const esFallecimiento = nombreUpper.includes('FALLECIMIENTO');
                const cfgKey = esFallecimiento ? 'FALLECIMIENTO' : esAccidente ? 'ACC_GRAVE' : 'ENF_TERMINAL';
                const cfgBase = cfgKey === 'FALLECIMIENTO' ? 3000 : 2000;
                const pagado = historialBeneficios
                  .filter((h) => h.tipo === cfgKey && (h.estado === 'PAGADA' || h.estado === 'APROBADA'))
                  .reduce((sum, h) => sum + h.monto, 0);
                const descuentoTipo = esEnfTerminal ? covidMontoTotal : 0;
                const disponible = Math.max(0, cfgBase - descuentoTipo - pagado);
                return (
                  <button key={t.id} type="button" onClick={() => {
                    setTipoSeleccionado(String(t.id));
                    if (!monto) setMonto(String(disponible > 0 ? disponible : 0));
                  }}
                    disabled={disponible <= 0}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${seleccionado ? 'border-primary bg-primary/5' : disponible <= 0 ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-border hover:border-primary/50'}`}>
                    <span className="text-sm font-semibold text-text-main block">{t.nombre}</span>
                    {disponible > 0 ? (
                      <span className="text-xs text-green-600 font-medium">Disponible: S/ {disponible.toLocaleString()}</span>
                    ) : (
                      <span className="text-xs text-red-500 font-medium">Agotado</span>
                    )}
                    {esEnfTerminal && covidMontoTotal > 0 && <span className="text-xs text-red-600 block">-{covidMontoTotal} COVID</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Formulario completo (solo si tipo seleccionado) */}
          {tipoSeleccionado && (
          <>
          {/* Monto y Solicitante */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Monto (S/) *</label>
              <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0.00" />
              {tipoSeleccionado && (() => {
                const disp = calcularMontoDisponible();
                return disp !== null ? (
                  <p className={`text-xs mt-1 ${disp > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    Disponible: S/ {disp.toLocaleString()} {disp === 0 ? '— Agotado' : ''}
                  </p>
                ) : null;
              })()}
              {descuento > 0 && (
                <p className="text-xs text-red-600 mt-1">Descuento COVID: -S/ {descuento}</p>
              )}
              {descuento > 0 && (
                <p className="text-xs font-semibold text-green-700 mt-0.5">Monto final: S/ {montoFinal}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Solicitante *</label>
              <select value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                {beneficiarios.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre} ({b.parentesco})</option>
                ))}
              </select>
            </div>
          </section>

          {/* Fechas */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">F. Recepción *</label>
              <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">F. Pago</label>
              <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">N.° Expediente</label>
              <input type="text" value={expedienteNumero} onChange={(e) => setExpedienteNumero(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Ej: 2300-2022" />
            </div>
          </section>

          {/* Documentación */}
          <section>
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Documentos PDF</h4>
            <div className="space-y-2">
              {DOCS_PDF.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-text-main">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${docsPresentados[key] ? 'text-green-600' : 'text-amber-600'}`}>
                      {docsPresentados[key] ? 'Presentado' : 'Pendiente'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={docsPresentados[key]}
                      aria-label={`${label}: ${docsPresentados[key] ? 'presentado' : 'pendiente'}`}
                      onClick={() => setDocsPresentados((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${docsPresentados[key] ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${docsPresentados[key] ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Datos administrativos */}
          <section>
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Datos Administrativos</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° Carta</label>
                <select value={cartaNumero} onChange={(e) => {
                  const carta = catalogoCartas.find((c: any) => c.numero === e.target.value);
                  setCartaNumero(e.target.value);
                  setCartaFecha(carta?.fecha ? new Date(carta.fecha).toISOString().slice(0, 10) : '');
                }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="">-- Seleccionar --</option>
                  {catalogoCartas.map((c: any) => (
                    <option key={c.id} value={c.numero}>{c.numero}{c.referencia ? ` — ${c.referencia}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Carta</label>
                <input type="date" value={cartaFecha} onChange={(e) => setCartaFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° Memorándum</label>
                <select value={memorandoNumero} onChange={(e) => {
                  const mem = catalogoMemorandos.find((m: any) => m.numero === e.target.value);
                  setMemorandoNumero(e.target.value);
                  setMemorandoFecha(mem?.fecha ? new Date(mem.fecha).toISOString().slice(0, 10) : '');
                }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="">-- Seleccionar --</option>
                  {catalogoMemorandos.map((m: any) => (
                    <option key={m.id} value={m.numero}>{m.numero}{m.asunto ? ` — ${m.asunto}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Memorándum</label>
                <input type="date" value={memorandoFecha} onChange={(e) => setMemorandoFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Forma de Pago</label>
                <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="">--</option>
                  {['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Banco</label>
                <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {/* Observaciones */}
          <section>
            <label className="block text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Observaciones</label>
            <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Notas adicionales..." />
          </section>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2">
            {guardando && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            Registrar Beneficio
          </button>
        </div>
      </div>
    </div>
  );
}
