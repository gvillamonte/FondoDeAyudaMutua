'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import PdfViewerModal from '@/components/common/PdfViewerModal';
import ConfirmCenterMessage, { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import EditarExpedienteModal from '@/components/fam/EditarExpedienteModal';
import CompletarBeneficiariosModal from '@/components/fam/CompletarBeneficiariosModal';
import PagoExpedienteModal from '@/components/fam/PagoExpedienteModal';
import EditarDepositoModal from '@/components/fam/EditarDepositoModal';
import HistorialExpediente from '@/components/fam/HistorialExpediente';
import EliminarExpedienteModal from '@/components/fam/EliminarExpedienteModal';

interface BeneficiarioVinculado {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
  tieneDeclaracionJurada?: boolean;
  declaracionJuradaDni?: string | null;
  tieneOrdenPago?: boolean;
}

interface DepositoBeneficiario {
  id: string;
  beneficiarioId: string | null;
  nombreBeneficiario: string | null;
  dniBeneficiario: string | null;
  porcentaje: number;
  monto: number;
  banco: string | null;
  numeroCuenta: string | null;
  cci: string | null;
  fechaPago: string | null;
  estado: string;
  tieneComprobante: boolean;
}

interface EstadoReparto {
  porcentajeAsignado: number;
  completo: boolean;
  declaracionesCompletas: boolean;
  beneficiariosFaltantes: string[];
  depositosRegistrados: number;
  listoParaPago: boolean;
  pagada: boolean;
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

interface DetalleExpediente {
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
  tieneFallecimiento?: boolean;
  estadoReparto?: EstadoReparto | null;
  montoBase?: number | null;
  depositos?: DepositoBeneficiario[];
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
  actaDefuncion: 'Acta de Defunción',
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

const fmt = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function DetalleExpedientePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [detalle, setDetalle] = useState<DetalleExpediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'montos' | 'docs' | 'benef' | 'admin' | 'historial'>('montos');
  const [docsOtros, setDocsOtros] = useState<Record<string, { docs: Record<string, boolean>; expediente: string; dniDJ: string; benefCount: number }>>({});
  const [docsCargados, setDocsCargados] = useState(false);
  const [docsGrupoSel, setDocsGrupoSel] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docTarget, setDocTarget] = useState<{ expedienteId: string; campo: string } | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);
  const [eliminarAbierto, setEliminarAbierto] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [editHistorialId, setEditHistorialId] = useState<string | null>(null);
  const [slaConfig, setSlaConfig] = useState<any[]>([]);
  const [completarOpen, setCompletarOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [depositoEdit, setDepositoEdit] = useState<DepositoBeneficiario | null>(null);
  const [formAdmin, setFormAdmin] = useState({
    estado: '', monto: '', fechaSolicitud: '', fechaPago: '',
    observaciones: '', formaPago: '', banco: '',
    cartaNumero: '', cartaFecha: '', memorandoNumero: '', memorandoFecha: '',
    expedienteNumero: '',
  });

  useEffect(() => {
    const user = getCurrentUser();
    setIsAdmin(user?.rol === 'ADMINISTRADOR');
    setUserRole(user?.rol || '');
  }, []);

  useEffect(() => {
    if (!id) return;
    let activo = true;
    setLoading(true);
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'docs') setActiveTab('docs');
    api.get(`/fam-beneficios/${id}`)
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
    api.get('/expediente-sla/config', { params: { activos: 'true' } })
      .then((slaRes) => {
        if (!activo) return;
        setSlaConfig(Array.isArray(slaRes.data) ? slaRes.data : []);
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [id]);

  const recargar = useCallback(() => {
    if (!id) return;
    api.get(`/fam-beneficios/${id}`).then(({ data }) => setDetalle(data));
  }, [id]);

  // Precarga los documentos de los demás expedientes del colegiado al entrar a Documentos
  useEffect(() => {
    if (activeTab !== 'docs' || !detalle) return;
    const otros = [...new Set((detalle.historialBeneficios || []).map((h) => h.id).filter((hid) => hid !== id))];
    if (otros.length === 0) { setDocsOtros({}); setDocsCargados(true); return; }
    let activo = true;
    setDocsCargados(false);
    Promise.all(otros.map((hid) =>
      api.get(`/fam-beneficios/${hid}`)
        .then(({ data }) => ({ hid, info: { docs: (data.documentosDisponibles || {}) as Record<string, boolean>, expediente: (data.expedienteNumero || '') as string, dniDJ: (data.declaracionJuradaDni || '') as string, benefCount: (data.beneficiariosVinculados || []).length } }))
        .catch(() => null)
    )).then((res) => {
      if (!activo) return;
      const mapa: Record<string, { docs: Record<string, boolean>; expediente: string; dniDJ: string; benefCount: number }> = {};
      res.forEach((r) => { if (r) mapa[r.hid] = r.info; });
      setDocsOtros(mapa);
      setDocsCargados(true);
    });
    return () => { activo = false; };
  }, [activeTab, detalle, id]);

  const irADocumentacion = (expedienteId?: string | null) => {
    if (!expedienteId) return;
    if (expedienteId === id) {
      setActiveTab('docs');
      return;
    }
    router.push(`/dashboard/fam/expedientes/${expedienteId}?tab=docs`);
  };

  const abrirPdf = async (expedienteId: string, campo: string) => {
    const key = `${expedienteId}:${campo}`;
    setPdfLoadingKey(key);
    try {
      const { data } = await api.get(`/fam-beneficios/${expedienteId}/documento/${campo}`);
      const numero = expedienteId === id ? detalle?.expedienteNumero : docsOtros[expedienteId]?.expediente;
      setPdfViewer({
        base64: data.contenido,
        nombre: `${DOCS_LABELS[campo] || 'Documento'}${numero ? ` · ${numero}` : ''}`,
      });
    } catch {
      alert('No se pudo abrir el documento.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  // Subida de documentos (solo ADMINISTRADOR — el backend exige ese rol en PUT /fam-beneficios/:id)
  const refrescarDocs = async (expedienteId: string) => {
    if (expedienteId === id) { recargar(); return; }
    try {
      const { data } = await api.get(`/fam-beneficios/${expedienteId}`);
      setDocsOtros((prev) => ({ ...prev, [expedienteId]: { docs: data.documentosDisponibles || {}, expediente: data.expedienteNumero || '', dniDJ: data.declaracionJuradaDni || '', benefCount: (data.beneficiariosVinculados || []).length } }));
    } catch { /* sin actualización de caché */ }
  };

  const pedirDocumento = (expedienteId: string, campo: string) => {
    if (!isAdmin) return;
    setDocTarget({ expedienteId, campo });
    if (docInputRef.current) docInputRef.current.value = '';
    docInputRef.current?.click();
  };

  const subirDocumento = async (file: File | null) => {
    if (!file || !docTarget) return;
    const { expedienteId, campo } = docTarget;
    const label = DOCS_LABELS[campo] || 'Documento';
    if (file.type !== 'application/pdf') { showConfirmMessage('error', `${label}: formato inválido`, 'Solo se permiten archivos PDF'); return; }
    if (file.size > 10 * 1024 * 1024) { showConfirmMessage('error', `${label}: excede 10MB`, `Archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`); return; }

    let declaracionJuradaDni: string | undefined;
    if (campo === 'declaracionJurada') {
      const previo = expedienteId === id ? (detalle?.declaracionJuradaDni || '') : (docsOtros[expedienteId]?.dniDJ || '');
      const respuesta = window.prompt('DNI del declarante (8 dígitos)', previo || '');
      if (respuesta === null) return;
      const dni = respuesta.trim();
      if (!/^\d{8}$/.test(dni)) { showConfirmMessage('error', 'DNI inválido', 'Debe tener exactamente 8 dígitos'); return; }
      declaracionJuradaDni = dni;
    }

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(((e.target?.result as string) || '').split(',')[1] || '');
      reader.readAsDataURL(file);
    });

    const key = `${expedienteId}:${campo}`;
    setSubiendoDoc(key);
    try {
      const previos = expedienteId === id ? (detalle?.documentosDisponibles || {}) : (docsOtros[expedienteId]?.docs || {});
      const nucleo = ['fichaAdmisibilidad', 'solicitudAsignacion', 'cartaRemision', 'memorando', 'ordenPago'];
      const tieneTodo = campo === 'otrosDocumentos' || Boolean(previos.otrosDocumentos);
      const completa = tieneTodo || nucleo.every((c) => c === campo || Boolean(previos[c]));
      await api.put(`/fam-beneficios/${expedienteId}`, { [campo]: base64, ...(declaracionJuradaDni && { declaracionJuradaDni }), ...(completa ? { documentacionCompleta: true } : {}) });
      showConfirmMessage('success', `${label} subido correctamente`, expedienteId === id ? detalle?.expedienteNumero || '' : docsOtros[expedienteId]?.expediente || '');
      await refrescarDocs(expedienteId);
    } catch (err: any) {
      showConfirmMessage('error', 'No se pudo subir el documento', err?.response?.data?.message || 'Intente nuevamente');
    } finally {
      setSubiendoDoc(null);
      setDocTarget(null);
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
      recargar();
      alert('Expediente actualizado correctamente');
    } catch (e: any) {
      alert('Error al guardar: ' + (e.response?.data?.message || 'Error desconocido'));
    } finally {
      setGuardandoAdmin(false);
    }
  };

  const eliminarExpediente = () => {
    if (!detalle) return;
    setEliminarAbierto(true);
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
        codigo, label: MONTOS_LABEL[codigo] || codigo, base, recibidoBruto,
        recibido, descuento, baseNeto, porRecibir, esActual,
        historial: historiales,
        expedientes: historiales.map((h) => h.expediente).filter(Boolean),
        estado: historiales.length > 0 ? (recibido >= baseNeto ? 'COMPLETO' : 'PARCIAL') : 'SIN_TRAMITE',
      };
    });

    filas.push({
      codigo: 'COVID_19', label: 'COVID-19 (Pandemia)',
      base: 0, recibidoBruto: covidTotal, recibido: covidTotal,
      descuento: 0, baseNeto: 0, porRecibir: 0,
      esActual: tipoActual === 'COVID_19',
      historial: (detalle.historialBeneficios || []).filter((h) => h.tipo === 'COVID_19'),
      expedientes: (detalle.historialBeneficios || []).filter((h) => h.tipo === 'COVID_19').map((h) => h.expediente).filter(Boolean),
      estado: covidTotal > 0 ? 'RECIBIDO' : 'SIN_REGISTRO',
    });

    // Si el beneficio por Fallecimiento ya se ejecutó (PAGADA/APROBADA),
    // no queda nada por recibir en ningún concepto.
    const fallecimientoEjecutado = filas.some((f) => f.codigo === 'FALLECIMIENTO' && f.historial.length > 0);
    if (fallecimientoEjecutado) {
      filas.forEach((f) => { f.porRecibir = 0; });
    }

    return filas;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-text-sec">Cargando expediente...</span>
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <p className="text-text-sec text-lg font-medium">Expediente no encontrado</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-primary hover:underline">Volver</button>
      </div>
    );
  }

  const filasMontos = calcFilasMontos();
  const baseTotalMontos = filasMontos.reduce((s, f) => s + f.base, 0);
  const recibidoNetoMontos = filasMontos.reduce((s, f) => s + f.recibido, 0);
  const porRecibirMontos = filasMontos.reduce((s, f) => s + f.porRecibir, 0);

  // Subpestañas de Documentos: un grupo por beneficio que tenga documentos subidos
  const registrosDocs: HistorialBeneficio[] = [...(detalle.historialBeneficios || [])];
  if (!registrosDocs.some((h) => h.id === id)) {
    registrosDocs.push({
      id,
      tipo: detalle.tipoBeneficio?.codigo || '',
      tipoNombre: detalle.tipoBeneficio?.nombre || '',
      monto: Number(detalle.monto) || 0,
      descuentoCovid: Number(detalle.descuentoCovid || 0),
      montoFinal: Number(detalle.montoFinal ?? detalle.monto) || 0,
      fecha: detalle.fechaSolicitud,
      fechaPago: detalle.fechaPago,
      expediente: detalle.expedienteNumero || '',
      solicitanteNombre: detalle.solicitanteNombre,
      solicitanteDni: detalle.solicitanteDni,
      estado: detalle.estado,
      esActual: true,
    });
  }
  const docsDeExpediente = (hid: string): Record<string, boolean> =>
    hid === id ? (detalle.documentosDisponibles || {}) : (docsOtros[hid]?.docs || {});
  const gruposDocs = registrosDocs.reduce((acc, h) => {
    const tieneDocs = Object.values(docsDeExpediente(h.id)).some(Boolean);
    if (!tieneDocs && !isAdmin) return acc;
    let g = acc.find((x) => x.tipo === h.tipo);
    if (!g) { g = { tipo: h.tipo, nombre: h.tipoNombre || h.tipo, registros: [] }; acc.push(g); }
    g.registros.push(h);
    return acc;
  }, [] as { tipo: string; nombre: string; registros: HistorialBeneficio[] }[]);
  const grupoDocsSel = gruposDocs.find((g) => g.tipo === docsGrupoSel)
    || gruposDocs.find((g) => g.registros.some((r) => r.id === id))
    || gruposDocs[0]
    || null;

  const puedeRegistrarHistorico = isAdmin || userRole === 'OPERADOR_PAGOS';
  const tiposFaltantes = ['Fallecimiento', 'Accidente Grave', 'Enfermedad Terminal'].filter((nombre) => {
    const configs: Record<string, string> = { 'Fallecimiento': 'FALLECIMIENTO', 'Accidente Grave': 'ACC_GRAVE', 'Enfermedad Terminal': 'ENF_TERMINAL' };
    const key = configs[nombre];
    return !detalle.historialBeneficios.some((h) => h.tipo === key && h.estado !== 'RECHAZADA');
  });

  const tieneFallecimiento = Boolean(detalle.tieneFallecimiento) ||
    (detalle.historialBeneficios || []).some((h) => h.tipo === 'FALLECIMIENTO' && h.estado !== 'RECHAZADA');

  const reparto = detalle.estadoReparto || null;
  const esTipoBolsa = Boolean(reparto);
  const depositos = detalle.depositos || [];
  const puedeOperar = isAdmin || userRole === 'OPERADOR_PAGOS';

  const verComprobanteDeposito = async (depositoId: string, nombre: string) => {
    try {
      const { data } = await api.get(`/fam-beneficios/${id}/deposito/${depositoId}/comprobante`);
      setPdfViewer({ base64: data.contenido, nombre });
    } catch {
      showConfirmMessage('error', 'No se pudo abrir el comprobante');
    }
  };

  const verOrdenPagoBeneficiario = async (beneficiarioId: string | null, nombre: string | null) => {
    if (!beneficiarioId) {
      showConfirmMessage('error', 'El depósito no tiene un beneficiario vinculado');
      return;
    }
    try {
      const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${beneficiarioId}/orden-pago`);
      setPdfViewer({ base64: data.contenido, nombre: `Orden de pago - ${nombre || 'Beneficiario'}` });
    } catch {
      showConfirmMessage('error', 'No se pudo abrir la orden de pago');
    }
  };

  const ESTADOS_FLUJO = ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'PAGADA'];
  const idxActual = ESTADOS_FLUJO.indexOf(detalle.estado);
  const horasTranscurridas = (Date.now() - new Date(detalle.fechaSolicitud || detalle.id).getTime()) / (1000 * 60 * 60);
  const configActual = slaConfig.find((c) => c.estado === detalle.estado);
  const horasLimite = configActual?.horasLimite || 0;
  const horasRestantes = horasLimite > 0 ? horasLimite - horasTranscurridas : null;

  return (
    <div className="space-y-5">
      <ConfirmCenterMessage />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <button onClick={() => router.push('/dashboard/fam/expedientes')} className="text-text-sec hover:text-primary transition-colors">Expedientes</button>
        <svg className="w-4 h-4 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-text-main font-medium truncate max-w-[300px]">{detalle.expedienteNumero || detalle.NOMBRE_COLEGIADO}</span>
      </nav>

      {/* Header principal */}
      <div className="bg-white border border-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-primary">{detalle.NOMBRE_COLEGIADO?.charAt(0) || '?'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold text-text-main truncate">{detalle.NOMBRE_COLEGIADO}</h1>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${ESTADO_COLORS[detalle.estado] || 'bg-gray-100 text-gray-600'}`}>
                  {detalle.estado.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-x-4 gap-y-1 mt-1 text-xs text-text-sec flex-wrap">
                <span className="font-semibold text-primary">CIP: {detalle.NUM_COLEGIATURA}</span>
                <span>DNI: {detalle.DNI}</span>
                <span className={detalle.ESTADO_COLEGIADO === 'HABILITADO' ? 'text-green-600 font-semibold' : ''}>{detalle.ESTADO_COLEGIADO}</span>
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right flex-shrink-0 space-y-2">
            <div>
              <p className="text-xl sm:text-2xl font-bold text-text-main">{fmtMonto(detalle.monto)}</p>
              {detalle.montoFinal != null && detalle.montoFinal !== detalle.monto && (
                <p className="text-xs text-green-600 font-semibold">Neto: {fmtMonto(detalle.montoFinal)}</p>
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={eliminarExpediente}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar expediente
              </button>
            )}
          </div>
        </div>

        {/* Info rápida */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-border">
          {[
            { label: 'Tipo', value: detalle.tipoBeneficio?.nombre || '—' },
            { label: 'Modalidad', value: MODALIDAD_LABELS[detalle.modalidadBeneficio || ''] || '—' },
            { label: 'N.° Expediente', value: detalle.expedienteNumero || '—' },
            { label: 'F. Recepción', value: fmt(detalle.fechaSolicitud) },
            { label: 'F. Pago', value: fmt(detalle.fechaPago) },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        {(detalle.fechaDefuncion || detalle.causaFallecimiento || detalle.fechaDiagnostico || detalle.diagnosticoMedico || detalle.fechaAccidente || detalle.descripcionAccidente) && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider mb-2">Datos del Beneficio</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {detalle.fechaDefuncion && (<div><span className="text-text-sec">F. Fallecimiento:</span> <span className="font-medium text-text-main">{fmt(detalle.fechaDefuncion)}</span></div>)}
              {detalle.causaFallecimiento && (<div><span className="text-text-sec">Causa:</span> <span className="font-medium text-text-main">{detalle.causaFallecimiento}</span></div>)}
              {detalle.fechaDiagnostico && (<div><span className="text-text-sec">F. Diagnóstico:</span> <span className="font-medium text-text-main">{fmt(detalle.fechaDiagnostico)}</span></div>)}
              {detalle.diagnosticoMedico && (<div><span className="text-text-sec">Diagnóstico:</span> <span className="font-medium text-text-main">{detalle.diagnosticoMedico}</span></div>)}
              {detalle.fechaAccidente && (<div><span className="text-text-sec">F. Accidente:</span> <span className="font-medium text-text-main">{fmt(detalle.fechaAccidente)}</span></div>)}
              {detalle.descripcionAccidente && (<div><span className="text-text-sec">Accidente:</span> <span className="font-medium text-text-main">{detalle.descripcionAccidente}</span></div>)}
            </div>
          </div>
        )}

        {detalle.tipoBeneficio?.codigo === 'FALLECIMIENTO' && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">Acta de Defunción</p>
            {detalle.documentosDisponibles?.actaDefuncion ? (
              <button
                onClick={() => abrirPdf(id, 'actaDefuncion')}
                disabled={pdfLoadingKey === `${id}:actaDefuncion`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                {pdfLoadingKey === `${id}:actaDefuncion` ? 'Abriendo...' : 'Ver PDF'}
              </button>
            ) : isAdmin ? (
              <button
                onClick={() => pedirDocumento(id, 'actaDefuncion')}
                disabled={subiendoDoc === `${id}:actaDefuncion`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                {subiendoDoc === `${id}:actaDefuncion` ? 'Subiendo...' : 'Subir PDF'}
              </button>
            ) : (
              <span className="text-xs text-gray-400">No cargado</span>
            )}
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-text-sec uppercase tracking-wider">Flujo del Expediente</span>
          {horasRestantes !== null && horasLimite > 0 && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              horasRestantes <= 0 ? 'text-red-600 bg-red-50 border border-red-200' :
              horasRestantes <= 12 ? 'text-amber-600 bg-amber-50 border border-amber-200' :
              'text-green-600 bg-green-50 border border-green-200'
            }`}>
              {horasRestantes <= 0
                ? `Vencido hace ${Math.abs(Math.floor(horasRestantes))}h`
                : `${Math.floor(horasRestantes)}h restantes`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {ESTADOS_FLUJO.map((estado, idx) => {
            const completado = idxActual >= 0 && idx < idxActual;
            const actual = estado === detalle.estado;
            const esRechazada = detalle.estado === 'RECHAZADA';
            return (
              <div key={estado} className="flex-1 flex flex-col items-center">
                <div className={`w-full h-2 rounded-full transition-colors ${
                  esRechazada && estado === 'APROBADA' ? 'bg-red-200' :
                  completado ? 'bg-green-500' : actual ? 'bg-primary' : 'bg-gray-200'
                }`} />
                <div className="flex items-center gap-1 mt-1.5">
                  {completado && <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  <span className={`text-[10px] font-semibold ${actual ? 'text-primary' : completado ? 'text-green-600' : 'text-text-sec'}`}>
                    {slaConfig.find((c) => c.estado === estado)?.nombreVisible || estado.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })}
          {detalle.estado === 'RECHAZADA' && (
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full h-2 rounded-full bg-red-500" />
              <div className="flex items-center gap-1 mt-1.5">
                <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                <span className="text-[10px] font-semibold text-red-600">Rechazada</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estado del reparto: expediente único con N beneficiarios */}
      {esTipoBolsa && reparto && detalle.estado !== 'RECHAZADA' && (
        <div className={`border rounded-xl p-4 ${reparto.pagada ? 'bg-emerald-50 border-emerald-200' : reparto.listoParaPago ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${reparto.pagada ? 'bg-emerald-600' : reparto.listoParaPago ? 'bg-primary' : 'bg-amber-500'}`}>
                {reparto.pagada ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </div>
              <div>
                <h3 className={`text-sm font-bold ${reparto.pagada ? 'text-emerald-800' : reparto.listoParaPago ? 'text-primary' : 'text-amber-800'}`}>
                  {reparto.pagada
                    ? 'Expediente pagado'
                    : reparto.listoParaPago
                      ? 'Listo para pago'
                      : reparto.completo
                        ? 'Declaraciones juradas pendientes'
                        : 'Expediente incompleto'}
                </h3>
                <p className={`text-xs mt-1 ${reparto.pagada ? 'text-emerald-700' : reparto.listoParaPago ? 'text-primary/80' : 'text-amber-700'}`}>
                  {reparto.pagada
                    ? `${depositos.length} depósito(s) registrado(s).`
                    : reparto.completo
                      ? `Reparto al 100%. Falta declaración jurada de: ${reparto.beneficiariosFaltantes.join(', ')}.`
                      : `Reparto asignado: ${reparto.porcentajeAsignado}% de 100%. Complete los beneficiarios y sus declaraciones juradas.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!reparto.pagada && puedeOperar && (
                <button onClick={() => setCompletarOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                  {reparto.completo ? 'Completar declaraciones juradas' : 'Completar expediente'}
                </button>
              )}
              {!reparto.pagada && reparto.listoParaPago && puedeOperar && (
                <button onClick={() => setPagoOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                  Registrar pago
                </button>
              )}
              {reparto.pagada && isAdmin && (
                <button onClick={() => setCompletarOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors">
                  Corregir declaraciones
                </button>
              )}
            </div>
          </div>

          {reparto.pagada && (
            <div className="mt-3 pt-3 border-t border-emerald-200">
              {depositos.length === 0 ? (
                <p className="text-xs text-emerald-700/80">Este pago no tiene depósitos individuales registrados (registro histórico).</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-text-sec border-b border-emerald-200">
                        <th className="px-2 py-1.5 font-semibold">Beneficiario</th>
                        <th className="px-2 py-1.5 font-semibold">DNI</th>
                        <th className="px-2 py-1.5 font-semibold text-right">%</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Monto</th>
                        <th className="px-2 py-1.5 font-semibold">Banco / Cuenta</th>
                        <th className="px-2 py-1.5 font-semibold">F. Pago</th>
                        <th className="px-2 py-1.5 font-semibold text-center">Comprobante</th>
                        {isAdmin && <th className="px-2 py-1.5 font-semibold text-center">Acción</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {depositos.map((d) => (
                        <tr key={d.id}>
                          <td className="px-2 py-1.5 font-medium text-text-main">{d.nombreBeneficiario || '—'}</td>
                          <td className="px-2 py-1.5 text-text-sec">{d.dniBeneficiario || '—'}</td>
                          <td className="px-2 py-1.5 text-right">{d.porcentaje}%</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{fmtMonto(d.monto)}</td>
                          <td className="px-2 py-1.5 text-text-sec">
                            {d.banco || '—'}{d.numeroCuenta ? ` · ${d.numeroCuenta}` : d.cci ? ` · CCI ${d.cci}` : ''}
                          </td>
                          <td className="px-2 py-1.5 text-text-sec">{fmt(d.fechaPago)}</td>
                          <td className="px-2 py-1.5 text-center">
                            {d.tieneComprobante ? (
                              <button onClick={() => verComprobanteDeposito(d.id, d.nombreBeneficiario || 'Comprobante')}
                                className="text-primary hover:underline font-medium">Ver</button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-2 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-3">
                                {detalle.beneficiariosVinculados.find((b) => b.id === d.beneficiarioId)?.tieneOrdenPago && (
                                  <button onClick={() => verOrdenPagoBeneficiario(d.beneficiarioId, d.nombreBeneficiario)}
                                    className="text-primary hover:underline font-medium">Ver PDF</button>
                                )}
                                <button onClick={() => setDepositoEdit(d)} className="text-primary hover:underline font-medium">Corregir</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alerta: beneficio por Fallecimiento ya cubierto en otro expediente */}
      {tieneFallecimiento && detalle.tipoBeneficio?.codigo !== 'FALLECIMIENTO' && (
        <div className="max-w-3xl mx-auto bg-red-600 border-2 border-red-700 rounded-xl p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">Beneficio por Fallecimiento ya registrado</h3>
          <p className="text-sm text-white/90 mt-2 leading-relaxed">
            Este colegiado ya cuenta con un beneficio por Fallecimiento. No se pueden registrar más beneficios para este colegiado.
          </p>
          <p className="text-xs text-white/75 mt-1.5">Los registros existentes pueden editarse normalmente.</p>
        </div>
      )}

      {/* Botones inteligentes por estado */}
      {isAdmin && (
        <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-text-sec uppercase tracking-wider mr-1">Acciones rápidas:</span>
          {detalle.estado === 'PENDIENTE' && (
            <button onClick={() => { setFormAdmin({ ...formAdmin, estado: 'EN_REVISION' }); }}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Iniciar Revisión
            </button>
          )}
          {detalle.estado === 'EN_REVISION' && (
            <>
              <button onClick={() => { setFormAdmin({ ...formAdmin, estado: 'APROBADA' }); }}
                className="px-4 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                Aprobar
              </button>
              <button onClick={() => { setFormAdmin({ ...formAdmin, estado: 'RECHAZADA' }); }}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                Rechazar
              </button>
            </>
          )}
          {detalle.estado === 'APROBADA' && esTipoBolsa && reparto && (
            <button
              onClick={() => reparto.listoParaPago
                ? setPagoOpen(true)
                : setCompletarOpen(true)}
              disabled={!reparto.listoParaPago}
              title={reparto.listoParaPago ? 'Registrar el pago del expediente' : 'Complete beneficiarios y declaraciones juradas para pagar'}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
              Registrar Pago
            </button>
          )}
          {detalle.estado === 'APROBADA' && !esTipoBolsa && (
            <button onClick={() => { setFormAdmin({ ...formAdmin, estado: 'PAGADA', fechaPago: new Date().toISOString().slice(0, 10) }); }}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
              Registrar Pago
            </button>
          )}
          {detalle.estado === 'RECHAZADA' && (
            <button onClick={() => { setFormAdmin({ ...formAdmin, estado: 'PENDIENTE' }); }}
              className="px-4 py-2 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors">
              Reabrir
            </button>
          )}
          <span className="ml-auto text-[10px] text-text-sec italic">Aplica al guardar en pestaña Admin</span>
        </div>
      )}

      {/* Acciones rápidas: registrar otros beneficios */}
      {puedeRegistrarHistorico && tiposFaltantes.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Registrar otros beneficios para este colegiado</h4>
            <button onClick={() => router.push(`/dashboard/fam/registrar-historico?colegiadoId=${detalle.colegiadoId}`)}
              className="text-xs text-primary hover:underline font-medium">
              Ver todos →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tiposFaltantes.map((nombre) => (
              <button key={nombre}
                onClick={() => router.push(`/dashboard/fam/registrar-historico?colegiadoId=${detalle.colegiadoId}&tipoPre=${encodeURIComponent(nombre)}`)}
                className="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors">
                + {nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {[
            { key: 'montos', label: 'Montos' },
            { key: 'docs', label: 'Documentos' },
            { key: 'benef', label: `Beneficiarios (${detalle.beneficiariosVinculados.length})` },
            { key: 'historial', label: 'Historial' },
            ...(isAdmin ? [{ key: 'admin', label: 'Admin' }] : []),
          ].map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-4 sm:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === t.key ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text-sec hover:text-text-main hover:bg-gray-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-5">
          {/* TAB: MONTOS */}
          {activeTab === 'montos' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-border">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider">Concepto</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase tracking-wider">Base</th>
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
                            <span
                              onClick={() => { if (fila.historial.length > 0) irADocumentacion(fila.esActual ? id : fila.historial[fila.historial.length - 1].id); }}
                              title={fila.historial.length > 0 ? 'Ver documentos adjuntos' : undefined}
                              className={`text-sm font-medium text-text-main ${fila.historial.length > 0 ? 'cursor-pointer hover:text-primary underline decoration-dotted underline-offset-2' : ''}`}
                            >
                              {fila.label}
                            </span>
                            {esActualFila && <span className="ml-2 inline-flex px-1.5 py-0.5 text-[10px] font-bold bg-primary text-white rounded">ACTUAL</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold">{fila.base > 0 ? fmtMonto(fila.base) : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {fila.descuento > 0 ? <span className="text-sm font-semibold text-red-600">- {fmtMonto(fila.descuento)}</span> : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {fila.codigo === 'COVID_19' && fila.recibido === 0 ? (
                              <span className="text-sm text-gray-400 italic">No registrado</span>
                            ) : fila.recibido > 0 ? (
                              <span className={`text-sm font-semibold ${estaRecibido ? 'text-green-700' : 'text-amber-600'}`}>{fmtMonto(fila.recibido)}</span>
                            ) : (
                              <span className="text-sm text-gray-400">S/ 0.00</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {fila.codigo === 'COVID_19' && fila.recibido === 0 ? (
                              <span className="text-sm text-gray-400">—</span>
                            ) : fila.porRecibir > 0 ? (
                              <span className="text-sm font-bold text-amber-600">{fmtMonto(fila.porRecibir)}</span>
                            ) : (
                              <span className="text-sm font-semibold text-green-700">{fmtMonto(0)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-sec">
                            {fila.codigo === 'COVID_19' && fila.recibido === 0 ? 'Sin registro' :
                              fila.historial.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {fila.historial.map((h: any) => (
                                    <div key={h.id} className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span onClick={() => irADocumentacion(h.id)} title="Ver documentos adjuntos"
                                          className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer hover:underline ${h.estado === 'PAGADA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {h.expediente || 'S/N'}
                                        </span>
                                        <span className="text-[10px] text-text-sec truncate max-w-[100px]">{h.solicitanteNombre || '—'}</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-text-sec">
                                        <span>F. Rec. <span className="font-medium text-text-main">{fmt(h.fecha)}</span></span>
                                        <span>F. Pago <span className={`font-medium ${h.fechaPago ? 'text-emerald-700' : 'text-text-sec'}`}>{fmt(h.fechaPago)}</span></span>
                                        <button onClick={() => irADocumentacion(h.id)}
                                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                          Docs
                                        </button>
                                      </div>
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

              <p className="text-[11px] text-text-sec italic">Haz clic en un concepto o en el N.° de expediente para ver los documentos adjuntos.</p>

              {/* Resumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-[10px] font-semibold text-green-700 uppercase">Base Total</p>
                  <p className="text-lg font-bold text-green-800 mt-1">{fmtMonto(baseTotalMontos)}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase">Recibido NETO</p>
                  <p className="text-lg font-bold text-amber-800 mt-1">
                    {fmtMonto(recibidoNetoMontos)}
                  </p>
                </div>
                <div className={`p-3 border rounded-lg text-center ${porRecibirMontos > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <p className={`text-[10px] font-semibold uppercase ${porRecibirMontos > 0 ? 'text-red-700' : 'text-green-700'}`}>Por Recibir</p>
                  <p className={`text-lg font-bold mt-1 ${porRecibirMontos > 0 ? 'text-red-800' : 'text-green-800'}`}>
                    {fmtMonto(porRecibirMontos)}
                  </p>
                </div>
              </div>

              {detalle.covidMontoTotal > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                  <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-800 rounded-full flex-shrink-0">COVID</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Recibido: {fmtMonto(detalle.covidMontoTotal)}</p>
                    <p className="text-[10px] text-amber-700">Se descuenta del beneficio de Enfermedad Terminal.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-border rounded-lg">
                  <p className="text-xs text-text-sec">Sin registro de asignación COVID-19.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: DOCUMENTOS */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <input ref={docInputRef} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => { subirDocumento(e.target.files?.[0] || null); if (e.target) e.target.value = ''; }} />

              <div className={`rounded-lg px-4 py-3 border ${detalle.documentacionCompleta ? 'bg-gray-50 border-border' : 'bg-red-50 border-red-200'}`}>
                <p className="text-sm font-semibold">
                  Documentación del expediente actual: {detalle.documentacionCompleta ? 'COMPLETA ✓' : 'INCOMPLETA ⚠️'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-text-sec">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isAdmin
                  ? 'Como ADMINISTRADOR puede subir o reemplazar los documentos PDF de cualquier beneficio.'
                  : 'Solo el ADMINISTRADOR puede subir documentos.'}
              </div>

              {!docsCargados ? (
                <div className="py-8 text-center text-text-sec text-sm">Cargando documentos…</div>
              ) : gruposDocs.length === 0 ? (
                <div className="py-8 text-center text-text-sec text-sm border border-dashed border-border rounded-lg">
                  No hay documentos subidos en los beneficios de este colegiado.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Subpestañas: un beneficio por cada uno con documentos subidos */}
                  <div className="flex border-b border-border overflow-x-auto">
                    {gruposDocs.map((g) => (
                      <button key={g.tipo} onClick={() => setDocsGrupoSel(g.tipo)}
                        className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${grupoDocsSel?.tipo === g.tipo ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text-sec hover:text-text-main'}`}>
                        {g.nombre}
                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-text-sec">{g.registros.length}</span>
                      </button>
                    ))}
                  </div>

                  {/* Documentos del beneficio seleccionado */}
                  {grupoDocsSel && grupoDocsSel.registros.map((reg) => (
                    <div key={reg.id} className="rounded-lg p-4 border border-border bg-gray-50">
                      {grupoDocsSel.registros.length > 1 && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary text-white">{reg.expediente || 'S/N'}</span>
                          <span className="text-xs text-text-sec">{fmt(reg.fecha)}</span>
                          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded ${ESTADO_COLORS[reg.estado] || 'bg-gray-100 text-gray-600'}`}>{reg.estado}</span>
                          {reg.esActual && <span className="text-[10px] font-bold text-primary">ACTUAL</span>}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(DOCS_LABELS)
                          .filter(([campo]) => {
                            if (campo !== 'ordenPago' && campo !== 'declaracionJurada') return true;
                            const benefCount = reg.id === id
                              ? (detalle?.beneficiariosVinculados?.length || 0)
                              : (docsOtros[reg.id]?.benefCount || 0);
                            return benefCount <= 1;
                          })
                          .map(([campo, label]) => {
                          const disponible = Boolean(docsDeExpediente(reg.id)[campo]);
                          const loadKey = `${reg.id}:${campo}`;
                          return (
                            <div key={campo} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-border">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${disponible ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-sm text-text-main">{label}</span>
                                {campo === 'declaracionJurada' && ((reg.id === id ? detalle?.declaracionJuradaDni : docsOtros[reg.id]?.dniDJ) || '') && (
                                  <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                    DNI {reg.id === id ? detalle?.declaracionJuradaDni : docsOtros[reg.id]?.dniDJ}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {disponible && (
                                  <button onClick={() => abrirPdf(reg.id, campo)} disabled={pdfLoadingKey === loadKey}
                                    className="text-xs text-primary hover:underline font-medium disabled:opacity-50">
                                    {pdfLoadingKey === loadKey ? 'Abriendo...' : 'Ver PDF'}
                                  </button>
                                )}
                                {isAdmin ? (
                                  <button onClick={() => pedirDocumento(reg.id, campo)} disabled={subiendoDoc === loadKey}
                                    className={`text-xs font-medium hover:underline disabled:opacity-50 ${disponible ? 'text-text-sec' : 'text-primary'}`}>
                                    {subiendoDoc === loadKey ? 'Subiendo...' : disponible ? 'Reemplazar' : 'Subir PDF'}
                                  </button>
                                ) : !disponible ? (
                                  <span className="text-xs text-gray-400">No cargado</span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: BENEFICIARIOS */}
          {activeTab === 'benef' && (
            <div>
              {esTipoBolsa && puedeOperar && detalle.estado !== 'PAGADA' && (
                <div className="flex justify-end mb-3">
                  <button onClick={() => setCompletarOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
                    Agregar / editar beneficiarios
                  </button>
                </div>
              )}
              {detalle.beneficiariosVinculados.length > 0 ? (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-border">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Nombre</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">DNI</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Parentesco</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-text-sec uppercase">% Asignado</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Declaración jurada</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-sec uppercase">Orden de pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detalle.beneficiariosVinculados.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-text-main">{b.nombre}</td>
                        <td className="px-4 py-3 text-sm text-text-sec">{b.dni || '—'}</td>
                        <td className="px-4 py-3 text-sm text-text-sec">{b.parentesco}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{b.porcentajeAsignado}%</td>
                        <td className="px-4 py-3 text-sm">
                          {b.tieneDeclaracionJurada ? (
                            <button
                              onClick={async () => {
                                try {
                                  const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${b.id}/declaracion`);
                                  setPdfViewer({ base64: data.contenido, nombre: `Declaración jurada - ${b.nombre}` });
                                } catch {
                                  showConfirmMessage('error', 'No se pudo abrir la declaración jurada');
                                }
                              }}
                              className="text-primary hover:underline font-medium text-xs">
                              Ver PDF{b.declaracionJuradaDni ? ` (DNI ${b.declaracionJuradaDni})` : ''}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">Pendiente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {b.tieneOrdenPago ? (
                            <button
                              onClick={async () => {
                                try {
                                  const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${b.id}/orden-pago`);
                                  setPdfViewer({ base64: data.contenido, nombre: `Orden de pago - ${b.nombre}` });
                                } catch {
                                  showConfirmMessage('error', 'No se pudo abrir la orden de pago');
                                }
                              }}
                              className="text-primary hover:underline font-medium text-xs">
                              Ver PDF
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ) : (
                <p className="text-sm text-text-sec text-center py-8">No hay beneficiarios vinculados</p>
              )}
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {activeTab === 'historial' && (
            <HistorialExpediente expedienteId={id} onUpdated={recargar} />
          )}

          {/* TAB: ADMIN */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-4">
              {detalle.historialBeneficios.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Historial de Beneficios</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-2 py-1.5 text-left font-semibold text-text-sec">F. Recepción</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-text-sec">F. Pago</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-text-sec">Tipo</th>
                          <th className="px-2 py-1.5 text-right font-semibold text-text-sec">Monto</th>
                          <th className="px-2 py-1.5 text-right font-semibold text-text-sec">Final</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-text-sec">Solicitante</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-text-sec">Estado</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-text-sec">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detalle.historialBeneficios
                          .slice().sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                          .map((h: any) => (
                            <tr key={h.id} className={`${h.esActual ? 'bg-primary/5 font-semibold' : ''}`}>
                              <td className="px-2 py-1.5">{h.fecha ? new Date(h.fecha).toLocaleDateString('es-PE') : '—'}</td>
                              <td className="px-2 py-1.5">{h.fechaPago ? new Date(h.fechaPago).toLocaleDateString('es-PE') : '—'}</td>
                              <td className="px-2 py-1.5">{h.tipoNombre}</td>
                              <td className="px-2 py-1.5 text-right">{fmtMonto(h.monto)}</td>
                              <td className="px-2 py-1.5 text-right font-semibold">{fmtMonto(h.montoFinal)}</td>
                              <td className="px-2 py-1.5">{h.solicitanteNombre || '—'}</td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded ${h.estado === 'PAGADA' ? 'bg-green-100 text-green-700' : h.estado === 'APROBADA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {h.estado}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button onClick={() => setEditHistorialId(h.id)} title="Editar este beneficio"
                                    className="p-1 rounded hover:bg-amber-50 text-amber-500 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                </td>
                              </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-3 border-t border-border">
                <button onClick={eliminarExpediente}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                  Eliminar
                </button>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (detalle) {
                      setFormAdmin({
                        estado: detalle.estado || '', monto: String(detalle.monto ?? ''),
                        fechaSolicitud: detalle.fechaSolicitud ? new Date(detalle.fechaSolicitud).toISOString().slice(0, 10) : '',
                        fechaPago: detalle.fechaPago ? new Date(detalle.fechaPago).toISOString().slice(0, 10) : '',
                        observaciones: detalle.observaciones || '', formaPago: detalle.formaPago || '',
                        banco: detalle.banco || '', cartaNumero: detalle.cartaNumero || '',
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
                    {guardandoAdmin ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {pdfViewer && (
        <PdfViewerModal base64={pdfViewer.base64} nombre={pdfViewer.nombre} onClose={() => setPdfViewer(null)} />
      )}

      {completarOpen && detalle && (
        <CompletarBeneficiariosModal
          isOpen={completarOpen}
          onClose={() => setCompletarOpen(false)}
          onSaved={recargar}
          expedienteId={id}
          colegiadoId={detalle.colegiadoId}
          pagada={detalle.estado === 'PAGADA'}
          isAdmin={isAdmin}
          modalidad={detalle.modalidadBeneficio}
          vinculados={detalle.beneficiariosVinculados}
        />
      )}

      {pagoOpen && detalle && (
        <PagoExpedienteModal
          isOpen={pagoOpen}
          onClose={() => setPagoOpen(false)}
          onSaved={recargar}
          expedienteId={id}
          monto={detalle.montoFinal ?? detalle.monto}
          bancoSugerido={detalle.banco}
          beneficiarios={detalle.beneficiariosVinculados}
          solicitanteNombre={detalle.solicitanteNombre}
          solicitanteDni={detalle.solicitanteDni}
        />
      )}

      {depositoEdit && (
        <EditarDepositoModal
          isOpen={Boolean(depositoEdit)}
          onClose={() => setDepositoEdit(null)}
          onSaved={recargar}
          expedienteId={id}
          deposito={depositoEdit}
        />
      )}

      {editHistorialId && (
        <EditarExpedienteModal
          expedienteId={editHistorialId}
          onClose={() => setEditHistorialId(null)}
          onSaved={() => {
            const eraActual = editHistorialId === id;
            setEditHistorialId(null);
            recargar();
            if (eraActual) {
              api.get(`/fam-beneficios/${id}`).then(({ data }) => {
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
              }).catch(() => {});
            }
          }}
        />
      )}

      {detalle && (
        <EliminarExpedienteModal
          isOpen={eliminarAbierto}
          onClose={() => setEliminarAbierto(false)}
          expedienteId={id}
          expedienteNumero={detalle.expedienteNumero}
          estado={detalle.estado}
          onDeleted={() => router.push('/dashboard/fam/expedientes')}
        />
      )}
    </div>
  );
}
