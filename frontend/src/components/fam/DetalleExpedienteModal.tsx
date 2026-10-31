'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface BeneficiarioVinculado {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
  tieneDeclaracionJurada?: boolean;
  tieneOrdenPago?: boolean;
}

interface HistorialBeneficio {
  id: string;
  tipo: string;
  tipoNombre: string;
  monto: number;
  descuentoCovid: number;
  montoFinal: number;
  fecha: string;
  fechaPago: string | null;
  expediente: string;
  solicitanteNombre: string | null;
  solicitanteDni: string | null;
  estado: string;
  esActual: boolean;
}

export interface DetalleExpediente {
  id: string;
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO_COLEGIADO: string;
  FECHA_ULTIMO_PAGO: string | null;
  tipoBeneficio?: { id: string; codigo: string; nombre: string };
  monto: number;
  moneda: string;
  estado: string;
  fechaSolicitud: string;
  fechaPago: string | null;
  documentacionCompleta: boolean;
  documentacionObservacion: string | null;
  solicitanteNombre: string | null;
  solicitanteDni: string | null;
  expedienteNumero: string | null;
  cartaNumero: string | null;
  cartaFecha: string | null;
  memorandoNumero: string | null;
  memorandoFecha: string | null;
  formaPago: string | null;
  banco: string | null;
  ordenPagoFecha: string | null;
  observaciones: string | null;
  descuentoCovid: number | null;
  montoFinal: number | null;
  modalidadBeneficio: string | null;
  documentosDisponibles: Record<string, boolean>;
  declaracionJuradaDni: string | null;
  fechaDefuncion?: string | null;
  causaFallecimiento?: string | null;
  fechaDiagnostico?: string | null;
  diagnosticoMedico?: string | null;
  fechaAccidente?: string | null;
  descripcionAccidente?: string | null;
  beneficiariosVinculados: BeneficiarioVinculado[];
  covidMontoTotal: number;
  historialBeneficios: HistorialBeneficio[];
}

const MONTOS_BASE: Record<string, number> = {
  FALLECIMIENTO: 3000,
  ACCIDENTE_GRAVE: 2000,
  ENF_TERMINAL: 2000,
};

const MONTOS_LABEL: Record<string, string> = {
  FALLECIMIENTO: 'Fallecimiento',
  ACCIDENTE_GRAVE: 'Accidente Grave',
  ENF_TERMINAL: 'Enfermedad Terminal',
};

const DOCS_LABELS: Record<string, string> = {
  fichaAdmisibilidad: 'Ficha de Admisibilidad',
  solicitudAsignacion: 'Solicitud de Asignación',
  cartaRemision: 'Carta de Remisión',
  memorando: 'Memorándum',
  ordenPago: 'Orden de Pago',
  sucesionIntestada: 'Sucesión Intestada',
  declaracionJurada: 'Declaración Jurada',
  otrosDocumentos: 'Otros / Documentación Completa',
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  EN_REVISION: 'bg-blue-100 text-blue-700',
  APROBADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
  PAGADA: 'bg-emerald-600 text-white',
};

const MODALIDAD_LABELS: Record<string, string> = {
  monto_unico: 'Monto Único',
  monto_compartido: 'Monto Compartido',
  opcion_sucesiva: 'Opción Sucesiva',
};

const fmt = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('es-PE') : '-');
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function DetalleExpedienteModal({ id, onClose, onDelete }: { id: string; onClose: () => void; onDelete?: () => void }) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleExpediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'montos' | 'docs' | 'benef' | 'admin'>('montos');
  const [isAdmin, setIsAdmin] = useState(false);
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [formAdmin, setFormAdmin] = useState({
    estado: '',
    monto: '',
    fechaSolicitud: '',
    fechaPago: '',
    observaciones: '',
    formaPago: '',
    banco: '',
    cartaNumero: '',
    cartaFecha: '',
    memorandoNumero: '',
    memorandoFecha: '',
    expedienteNumero: '',
  });

  useEffect(() => {
    const user = getCurrentUser();
    setIsAdmin(user?.rol === 'ADMINISTRADOR');
    setUserRole(user?.rol || '');
  }, []);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    api
      .get(`/fam-beneficios/${id}`)
      .then(({ data }) => {
        if (!activo) return;
        setDetalle(data);
        setFormAdmin({
          estado: data.estado || '',
          monto: String(data.monto ?? ''),
          fechaSolicitud: data.fechaSolicitud ? new Date(data.fechaSolicitud).toISOString().slice(0, 10) : '',
          fechaPago: data.fechaPago ? new Date(data.fechaPago).toISOString().slice(0, 10) : '',
          observaciones: data.observaciones || '',
          formaPago: data.formaPago || '',
          banco: data.banco || '',
          cartaNumero: data.cartaNumero || '',
          cartaFecha: data.cartaFecha ? new Date(data.cartaFecha).toISOString().slice(0, 10) : '',
          memorandoNumero: data.memorandoNumero || '',
          memorandoFecha: data.memorandoFecha ? new Date(data.memorandoFecha).toISOString().slice(0, 10) : '',
          expedienteNumero: data.expedienteNumero || '',
        });
      })
      .catch(() => { if (activo) setDetalle(null); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [id]);

  const abrirPdf = async (campo: string) => {
    setPdfLoadingKey(campo);
    try {
      const { data } = await api.get(`/fam-beneficios/${id}/documento/${campo}`);
      const bytes = Uint8Array.from(atob(data.contenido), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      alert('No se pudo abrir el documento.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const abrirOrdenPagoBeneficiario = async (beneficiarioId: string) => {
    try {
      const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${beneficiarioId}/orden-pago`);
      const bytes = Uint8Array.from(atob(data.contenido), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      alert('No se pudo abrir la orden de pago.');
    }
  };

  const guardarAdmin = async () => {
    setGuardandoAdmin(true);
    try {
      await api.put(`/fam-beneficios/${id}`, {
        estado: formAdmin.estado || undefined,
        monto: formAdmin.monto ? parseFloat(formAdmin.monto) : undefined,
        fechaSolicitud: formAdmin.fechaSolicitud || undefined,
        fechaPago: formAdmin.fechaPago || undefined,
        observaciones: formAdmin.observaciones || undefined,
        formaPago: formAdmin.formaPago || undefined,
        banco: formAdmin.banco || undefined,
        cartaNumero: formAdmin.cartaNumero || undefined,
        cartaFecha: formAdmin.cartaFecha || undefined,
        memorandoNumero: formAdmin.memorandoNumero || undefined,
        memorandoFecha: formAdmin.memorandoFecha || undefined,
        expedienteNumero: formAdmin.expedienteNumero || undefined,
      });
      // Recargar detalle
      const { data } = await api.get(`/fam-beneficios/${id}`);
      setDetalle(data);
      setFormAdmin({
        estado: data.estado || '',
        monto: String(data.monto ?? ''),
        fechaSolicitud: data.fechaSolicitud ? new Date(data.fechaSolicitud).toISOString().slice(0, 10) : '',
        fechaPago: data.fechaPago ? new Date(data.fechaPago).toISOString().slice(0, 10) : '',
        observaciones: data.observaciones || '',
        formaPago: data.formaPago || '',
        banco: data.banco || '',
        cartaNumero: data.cartaNumero || '',
        cartaFecha: data.cartaFecha ? new Date(data.cartaFecha).toISOString().slice(0, 10) : '',
        memorandoNumero: data.memorandoNumero || '',
        memorandoFecha: data.memorandoFecha ? new Date(data.memorandoFecha).toISOString().slice(0, 10) : '',
        expedienteNumero: data.expedienteNumero || '',
      });
      alert('Expediente actualizado correctamente');
    } catch (e: any) {
      alert('Error al guardar: ' + (e.response?.data?.message || 'Error desconocido'));
    } finally {
      setGuardandoAdmin(false);
    }
  };

  const eliminarExpediente = async () => {
    if (!detalle) return;
    const expedienteNro = detalle.expedienteNumero || detalle.id.slice(0, 8);
    const confirmar = window.confirm(
      `¿Eliminar el expediente ${expedienteNro}?\n\nEsta acción no se puede deshacer. Se eliminarán también los beneficiarios vinculados a este expediente.`
    );
    if (!confirmar) return;

    setEliminando(true);
    try {
      await api.delete(`/fam-beneficios/${id}`);
      alert('Expediente eliminado correctamente');
      if (onDelete) onDelete();
      onClose();
    } catch (e: any) {
      alert('Error al eliminar: ' + (e.response?.data?.message || 'Error desconocido'));
    } finally {
      setEliminando(false);
    }
  };

  const calcFilasMontos = () => {
    if (!detalle) return [];
    const tipoActual = detalle.tipoBeneficio?.codigo || '';
    const covidTotal = detalle.covidMontoTotal || 0;

    const filas = Object.entries(MONTOS_BASE).map(([codigo, base]) => {
      const historiales = (detalle.historialBeneficios || []).filter((h) => h.tipo === codigo);
      const recibidoBruto = historiales.reduce((sum, h) => sum + h.monto, 0);
      const descuento = codigo === 'ENF_TERMINAL' ? covidTotal : 0;
      const baseNeto = base - descuento;
      const recibido = Math.min(recibidoBruto, Math.max(0, baseNeto));
      const porRecibir = Math.max(0, baseNeto - recibido);
      const esActual = historiales.some((h) => h.esActual);
      return {
        codigo,
        label: MONTOS_LABEL[codigo] || codigo,
        base,
        recibidoBruto,
        recibido,
        descuento,
        baseNeto,
        porRecibir,
        esActual,
        historial: historiales,
        expedientes: historiales.map((h) => h.expediente).filter(Boolean),
        estado: historiales.length > 0 ? (recibido >= baseNeto ? 'COMPLETO' : 'PARCIAL') : 'SIN_TRAMITE',
      };
    });

    filas.push({
      codigo: 'COVID_19',
      label: 'COVID-19 (Pandemia)',
      base: 0,
      recibidoBruto: covidTotal,
      recibido: covidTotal,
      descuento: 0,
      baseNeto: 0,
      porRecibir: 0,
      esActual: tipoActual === 'COVID_19',
      historial: (detalle.historialBeneficios || []).filter((h) => h.tipo === 'COVID_19'),
      expedientes: (detalle.historialBeneficios || []).filter((h) => h.tipo === 'COVID_19').map((h) => h.expediente).filter(Boolean),
      estado: covidTotal > 0 ? 'RECIBIDO' : 'SIN_REGISTRO',
    });

    return filas;
  };

  const filasMontos = calcFilasMontos();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[1100px] max-w-[96vw] max-h-[95vh] sm:max-h-[92vh] flex flex-col">

        {/* HEADER */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-white rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-text-main">
              Expediente {detalle?.expedienteNumero || ''}
            </h3>
            <p className="text-sm text-text-sec">
              {detalle ? `${detalle.NUM_COLEGIATURA} — ${detalle.NOMBRE_COLEGIADO}` : 'Cargando...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {detalle && (
              <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${ESTADO_COLORS[detalle.estado] || 'bg-gray-100 text-gray-700'}`}>
                {detalle.estado}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {loading || !detalle ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : (
          <>
            {/* COLEGIADO + EXPEDIENTE — 2 columnas */}
            <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-0 border-b border-border">
              {/* Colegiado */}
              <div className="px-4 sm:px-6 py-4 lg:border-r border-border">
                <h4 className="text-[10px] font-semibold text-text-sec uppercase tracking-widest mb-2">Colegiado</h4>
                <p className="text-base font-bold text-text-main leading-snug">{detalle.NOMBRE_COLEGIADO || '-'}</p>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-text-sec">
                  <span>CIP: <span className="font-semibold text-primary">{detalle.NUM_COLEGIATURA || detalle.colegiadoId}</span></span>
                  <span>DNI: <span className="font-medium text-text-main">{detalle.DNI || '-'}</span></span>
                  <span>Estado: <span className={`font-medium ${detalle.ESTADO_COLEGIADO === 'HABILITADO' ? 'text-green-700' : 'text-red-600'}`}>{detalle.ESTADO_COLEGIADO || '-'}</span></span>
                </div>
                <div className="mt-1.5 text-xs text-text-sec">
                  <span>Último pago: <span className="font-medium text-text-main">{fmt(detalle.FECHA_ULTIMO_PAGO)}</span></span>
                </div>
              </div>
              {/* Expediente */}
              <div className="px-4 sm:px-6 py-4">
                <h4 className="text-[10px] font-semibold text-text-sec uppercase tracking-widest mb-2">Expediente</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-text-sec">Tipo</span><span className="font-medium text-text-main">{detalle.tipoBeneficio?.nombre || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-text-sec">Modalidad</span><span className="font-medium text-text-main">{MODALIDAD_LABELS[detalle.modalidadBeneficio || ''] || detalle.modalidadBeneficio || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-text-sec">F. Recepción</span><span className="text-text-main">{fmt(detalle.fechaSolicitud)}</span></div>
                  <div className="flex justify-between"><span className="text-text-sec">F. Pago</span><span className="text-text-main">{fmt(detalle.fechaPago)}</span></div>
                  <div className="flex justify-between"><span className="text-text-sec">N.° Expediente</span><span className="text-text-main font-medium">{detalle.expedienteNumero || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-text-sec">Solicitante</span><span className="text-primary font-semibold truncate max-w-[160px]" title={detalle.solicitanteNombre || ''}>{detalle.solicitanteNombre || '-'}</span></div>
                </div>
              </div>
            </div>

            {/* TABS */}
            <div className="flex-shrink-0 flex border-b border-border bg-gray-50 overflow-x-auto">
              {[
                { key: 'montos', label: 'Desglose de Montos' },
                { key: 'docs', label: 'Documentos' },
                { key: 'benef', label: `Beneficiarios (${detalle.beneficiariosVinculados.length})` },
                ...(isAdmin ? [{ key: 'admin', label: 'Admin' }] : []),
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`px-4 sm:px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === t.key ? 'border-primary text-primary bg-white' : 'border-transparent text-text-sec hover:text-text-main hover:bg-gray-100'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 sm:py-5">

              {/* TAB: MONTOS */}
              {activeTab === 'montos' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border">
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider">Concepto</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase tracking-wider">Monto Base</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase tracking-wider">Descuento</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase tracking-wider">Recibido NETO</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase tracking-wider">Por Recibir</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filasMontos.map((fila) => {
                          const esActualFila = fila.esActual;
                          const estaRecibido = fila.recibido >= fila.baseNeto && fila.baseNeto > 0;
                          return (
                            <tr key={fila.codigo} className={`${esActualFila ? 'bg-primary/5' : ''} hover:bg-gray-50/50`}>
                              <td className="px-4 py-3">
                                <span className="text-sm font-medium text-text-main">{fila.label}</span>
                                {esActualFila && <span className="ml-2 inline-flex px-1.5 py-0.5 text-[10px] font-bold bg-primary text-white rounded">ACTUAL</span>}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-text-main">
                                {fila.base > 0 ? fmtMonto(fila.base) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {fila.descuento > 0 ? (
                                  <span className="text-sm font-semibold text-red-600">- {fmtMonto(fila.descuento)}</span>
                                ) : (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {fila.codigo === 'COVID_19' && fila.recibido === 0 ? (
                                  <span className="text-sm text-gray-400 italic">No registrado</span>
                                ) : fila.recibido > 0 ? (
                                  <span className={`text-sm font-semibold ${estaRecibido ? 'text-green-700' : 'text-amber-600'}`}>
                                    {fmtMonto(fila.recibido)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">S/ 0.00</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {fila.codigo === 'COVID_19' && fila.recibido === 0 ? (
                                  <span className="text-sm text-gray-400 italic">—</span>
                                ) : fila.porRecibir > 0 ? (
                                  <span className="text-sm font-bold text-amber-600">{fmtMonto(fila.porRecibir)}</span>
                                ) : (
                                  <span className="text-sm font-semibold text-green-700">{fmtMonto(0)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-text-sec">
                                {fila.codigo === 'COVID_19' && fila.recibido === 0
                                  ? 'Sin expediente registrado'
                                  : fila.historial.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {fila.historial.map((h: any) => (
                                        <div key={h.id} className="flex items-center gap-1.5">
                                          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded ${h.estado === 'PAGADA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {h.expediente || 'S/N'}
                                          </span>
                                          <span className="text-[10px] text-text-sec truncate max-w-[120px]">
                                            {h.solicitanteNombre || '—'}
                                          </span>
                                          {h.esActual && <span className="text-[10px] font-bold text-primary">ACT</span>}
                                        </div>
                                      ))}
                                    </div>
                                  ) : '—'
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Botón nuevo histórico */}
                  {(isAdmin || userRole === 'OPERADOR_PAGOS') && (
                    <div className="flex justify-end">
                      <button onClick={() => router.push(`/dashboard/fam/registrar-historico?colegiadoId=${detalle?.colegiadoId}`)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        Registrar beneficio histórico
                      </button>
                    </div>
                  )}

                  {/* Resumen */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                      <p className="text-[10px] font-semibold text-green-700 uppercase">Monto Base Total</p>
                      <p className="text-lg font-bold text-green-800 mt-1">{fmtMonto(7000)}</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <p className="text-[10px] font-semibold text-amber-700 uppercase">Total Recibido NETO</p>
                      <p className="text-lg font-bold text-amber-800 mt-1">
                        {fmtMonto(filasMontos.filter((f) => f.codigo !== 'COVID_19').reduce((s, f) => s + f.recibido, 0))}
                      </p>
                    </div>
                    <div className={`p-3 border rounded-lg text-center ${filasMontos.filter((f) => f.codigo !== 'COVID_19').reduce((s, f) => s + f.porRecibir, 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <p className={`text-[10px] font-semibold uppercase ${filasMontos.filter((f) => f.codigo !== 'COVID_19').reduce((s, f) => s + f.porRecibir, 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>Total Por Recibir</p>
                      <p className={`text-lg font-bold mt-1 ${filasMontos.filter((f) => f.codigo !== 'COVID_19').reduce((s, f) => s + f.porRecibir, 0) > 0 ? 'text-red-800' : 'text-green-800'}`}>
                        {fmtMonto(filasMontos.filter((f) => f.codigo !== 'COVID_19').reduce((s, f) => s + f.porRecibir, 0))}
                      </p>
                    </div>
                  </div>

                  {detalle.covidMontoTotal > 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-800 rounded-full">COVID-19</span>
                        <span className="text-sm font-semibold text-amber-800">Monto recibido: {fmtMonto(detalle.covidMontoTotal)}</span>
                      </div>
                      <p className="text-xs text-amber-700">Este monto se descuenta del beneficio de Enfermedad Terminal (S/ 2,000 base).</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-gray-200 text-gray-600 rounded-full">COVID-19</span>
                        <span className="text-sm font-medium text-gray-500">Sin registro de asignación COVID</span>
                      </div>
                      <p className="text-xs text-gray-400">No se encontraron asignaciones COVID-19 para este colegiado. No se aplica descuento en Enfermedad Terminal.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: DOCUMENTOS */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <div className={`rounded-lg p-4 border ${detalle.documentacionCompleta ? 'bg-gray-50 border-border' : 'bg-red-50 border-red-200'}`}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className={detalle.documentacionCompleta ? 'text-text-sec' : 'text-red-600'}>
                        Documentación: {detalle.documentacionCompleta ? 'COMPLETA ✓' : 'INCOMPLETA ⚠️'}
                      </span>
                    </h4>
                    {!detalle.documentacionCompleta && (
                      <p className="text-sm text-red-700 mb-3">
                        <strong>Justificación:</strong> {detalle.documentacionObservacion || '-'}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(DOCS_LABELS).map(([campo, label]) => (
                        <div key={campo} className="flex items-center justify-between text-sm px-3 py-2 bg-white border border-border rounded-lg">
                          <span className="text-text-sec inline-flex items-center gap-2">
                            {label}
                            {campo === 'declaracionJurada' && detalle.declaracionJuradaDni && (
                              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">DNI {detalle.declaracionJuradaDni}</span>
                            )}
                          </span>
                          {detalle.documentosDisponibles?.[campo] ? (
                            <button onClick={() => abrirPdf(campo)} disabled={pdfLoadingKey === campo}
                              className="text-xs font-medium text-primary hover:text-primary-dark inline-flex items-center gap-1 disabled:opacity-50">
                              {pdfLoadingKey === campo ? 'Abriendo...' : '📄 Ver PDF'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Sin archivo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Administrativo</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <span className="text-text-sec">Carta N°:</span><span className="text-text-main">{detalle.cartaNumero || '-'} / {fmt(detalle.cartaFecha)}</span>
                      <span className="text-text-sec">Memorándum N°:</span><span className="text-text-main">{detalle.memorandoNumero || '-'} / {fmt(detalle.memorandoFecha)}</span>
                      <span className="text-text-sec">Forma de Pago:</span><span className="text-text-main">{detalle.formaPago || '-'}</span>
                      <span className="text-text-sec">Banco:</span><span className="text-text-main">{detalle.banco || '-'}</span>
                      <span className="text-text-sec">F. Orden de Pago:</span><span className="text-text-main">{fmt(detalle.ordenPagoFecha)}</span>
                    </div>
                  </div>

                  {(detalle.fechaDefuncion || detalle.causaFallecimiento || detalle.fechaDiagnostico || detalle.diagnosticoMedico || detalle.fechaAccidente || detalle.descripcionAccidente) && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Datos del Beneficio</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        {detalle.fechaDefuncion && (<><span className="text-text-sec">Fecha de Fallecimiento:</span><span className="text-text-main">{fmt(detalle.fechaDefuncion)}</span></>)}
                        {detalle.causaFallecimiento && (<><span className="text-text-sec">Causa de Fallecimiento:</span><span className="text-text-main">{detalle.causaFallecimiento}</span></>)}
                        {detalle.fechaDiagnostico && (<><span className="text-text-sec">Fecha de Diagnóstico:</span><span className="text-text-main">{fmt(detalle.fechaDiagnostico)}</span></>)}
                        {detalle.diagnosticoMedico && (<><span className="text-text-sec">Diagnóstico Médico:</span><span className="text-text-main">{detalle.diagnosticoMedico}</span></>)}
                        {detalle.fechaAccidente && (<><span className="text-text-sec">Fecha de Accidente:</span><span className="text-text-main">{fmt(detalle.fechaAccidente)}</span></>)}
                        {detalle.descripcionAccidente && (<><span className="text-text-sec">Descripción del Accidente:</span><span className="text-text-main">{detalle.descripcionAccidente}</span></>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: BENEFICIARIOS */}
              {activeTab === 'benef' && (
                <div className="space-y-4">
                  {detalle.beneficiariosVinculados.length === 0 ? (
                    <p className="text-sm text-text-sec italic text-center py-8">Sin beneficiarios vinculados.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-border">
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Nombre</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">DNI</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Parentesco</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase">% Asignado</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase">Monto</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Orden de pago</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {detalle.beneficiariosVinculados.map((b) => {
                            const montoRef = detalle.montoFinal ?? detalle.monto;
                            const corresponde = (detalle.modalidadBeneficio === 'monto_compartido')
                              ? (b.porcentajeAsignado / 100) * montoRef
                              : montoRef;
                            return (
                              <tr key={b.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-text-main">{b.nombre}</td>
                                <td className="px-4 py-3 text-sm text-text-sec">{b.dni || '-'}</td>
                                <td className="px-4 py-3 text-sm text-text-sec">{b.parentesco}</td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{b.porcentajeAsignado}%</td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">{fmtMonto(corresponde)}</td>
                                <td className="px-4 py-3 text-sm">
                                  {b.tieneOrdenPago ? (
                                    <button type="button" onClick={() => abrirOrdenPagoBeneficiario(b.id)} className="text-xs font-medium text-primary hover:underline">
                                      Ver PDF
                                    </button>
                                  ) : (
                                    <span className="text-xs font-semibold text-amber-600">Pendiente</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detalle.observaciones && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Observaciones</h4>
                      <p className="text-sm text-text-main whitespace-pre-wrap">{detalle.observaciones}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: ADMIN */}
              {activeTab === 'admin' && isAdmin && (
                <div className="space-y-5">
                  <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Edición de Expediente (Administrador)
                  </h4>

                  {/* Estado y Monto */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Estado y Monto</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Estado</label>
                        <select value={formAdmin.estado} onChange={(e) => setFormAdmin({ ...formAdmin, estado: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white">
                          <option value="PENDIENTE">PENDIENTE</option>
                          <option value="EN_REVISION">EN REVISIÓN</option>
                          <option value="APROBADA">APROBADA</option>
                          <option value="RECHAZADA">RECHAZADA</option>
                          <option value="PAGADA">PAGADA</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Monto (S/)</label>
                        <input type="number" min={0} step="0.01" value={formAdmin.monto}
                          onChange={(e) => setFormAdmin({ ...formAdmin, monto: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° Expediente</label>
                        <input value={formAdmin.expedienteNumero}
                          onChange={(e) => setFormAdmin({ ...formAdmin, expedienteNumero: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Fechas */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Fechas</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Recepción</label>
                        <input type="date" value={formAdmin.fechaSolicitud}
                          onChange={(e) => setFormAdmin({ ...formAdmin, fechaSolicitud: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Pago</label>
                        <input type="date" value={formAdmin.fechaPago}
                          onChange={(e) => setFormAdmin({ ...formAdmin, fechaPago: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div></div>
                    </div>
                  </div>

                  {/* Documentación */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Documentación</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Carta N°</label>
                        <input value={formAdmin.cartaNumero}
                          onChange={(e) => setFormAdmin({ ...formAdmin, cartaNumero: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Carta</label>
                        <input type="date" value={formAdmin.cartaFecha}
                          onChange={(e) => setFormAdmin({ ...formAdmin, cartaFecha: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Memorándum N°</label>
                        <input value={formAdmin.memorandoNumero}
                          onChange={(e) => setFormAdmin({ ...formAdmin, memorandoNumero: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Memorándum</label>
                        <input type="date" value={formAdmin.memorandoFecha}
                          onChange={(e) => setFormAdmin({ ...formAdmin, memorandoFecha: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Forma de Pago</label>
                        <select value={formAdmin.formaPago}
                          onChange={(e) => setFormAdmin({ ...formAdmin, formaPago: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white">
                          <option value="">--</option>
                          {['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'].map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Banco</label>
                        <input value={formAdmin.banco}
                          onChange={(e) => setFormAdmin({ ...formAdmin, banco: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Observaciones</h5>
                    <textarea value={formAdmin.observaciones}
                      onChange={(e) => setFormAdmin({ ...formAdmin, observaciones: e.target.value })} rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                  </div>

                  {/* Historial completo del colegiado */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Historial de Beneficios del Colegiado</h5>
                    {detalle.historialBeneficios.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="px-2 py-1.5 text-left font-semibold text-text-sec">Fecha</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-text-sec">Tipo</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-text-sec">Monto</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-text-sec">Desc.</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-text-sec">Final</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-text-sec">Solicitante</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-text-sec">N.° Exp.</th>
                              <th className="px-2 py-1.5 text-center font-semibold text-text-sec">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {detalle.historialBeneficios
                              .slice()
                              .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                              .map((h: any) => (
                                <tr key={h.id} className={`${h.esActual ? 'bg-primary/5 font-semibold' : ''}`}>
                                  <td className="px-2 py-1.5">{h.fecha ? new Date(h.fecha).toLocaleDateString('es-PE') : '—'}</td>
                                  <td className="px-2 py-1.5">{h.tipoNombre}</td>
                                  <td className="px-2 py-1.5 text-right">{fmtMonto(h.monto)}</td>
                                  <td className="px-2 py-1.5 text-right text-red-600">{h.descuentoCovid > 0 ? `- ${fmtMonto(h.descuentoCovid)}` : '—'}</td>
                                  <td className="px-2 py-1.5 text-right font-semibold">{fmtMonto(h.montoFinal)}</td>
                                  <td className="px-2 py-1.5">{h.solicitanteNombre || '—'}</td>
                                  <td className="px-2 py-1.5 font-mono">{h.expediente || '—'}</td>
                                  <td className="px-2 py-1.5 text-center">
                                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded ${h.estado === 'PAGADA' ? 'bg-green-100 text-green-700' : h.estado === 'APROBADA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {h.estado}
                                    </span>
                                    {h.esActual && <span className="ml-1 text-[10px] font-bold text-primary">ACTUAL</span>}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-text-sec italic">Sin beneficios registrados para este colegiado</p>
                    )}
                  </div>

                  {/* Botones */}
                  <div className="flex justify-between pt-3 border-t border-border">
                    <button onClick={eliminarExpediente} disabled={eliminando}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                      {eliminando ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          Eliminar expediente
                        </>
                      )}
                    </button>
                    <div className="flex gap-3">
                      <button onClick={() => {
                        if (detalle) {
                          setFormAdmin({
                            estado: detalle.estado || '',
                            monto: String(detalle.monto ?? ''),
                            fechaSolicitud: detalle.fechaSolicitud ? new Date(detalle.fechaSolicitud).toISOString().slice(0, 10) : '',
                            fechaPago: detalle.fechaPago ? new Date(detalle.fechaPago).toISOString().slice(0, 10) : '',
                            observaciones: detalle.observaciones || '',
                            formaPago: detalle.formaPago || '',
                            banco: detalle.banco || '',
                            cartaNumero: detalle.cartaNumero || '',
                            cartaFecha: detalle.cartaFecha ? new Date(detalle.cartaFecha).toISOString().slice(0, 10) : '',
                            memorandoNumero: detalle.memorandoNumero || '',
                            memorandoFecha: detalle.memorandoFecha ? new Date(detalle.memorandoFecha).toISOString().slice(0, 10) : '',
                            expedienteNumero: detalle.expedienteNumero || '',
                          });
                        }
                      }}
                        className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">
                        Restablecer
                      </button>
                      <button onClick={guardarAdmin} disabled={guardandoAdmin}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                        {guardandoAdmin ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
