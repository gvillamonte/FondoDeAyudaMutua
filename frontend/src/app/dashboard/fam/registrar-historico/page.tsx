'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import { getCurrentUser } from '@/lib/auth';
import PdfViewerModal from '@/components/common/PdfViewerModal';

interface BeneficiarioVinculado {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
  declaracionJurada?: string;
  declaracionJuradaDni?: string;
  declaracionSize?: number;
  ordenPago?: string;
  ordenPagoSize?: number;
}

interface TipoBeneficioOpt { id: number; nombre: string; descripcion?: string; }

interface ColegiadoInfo {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  NOMBRE_COLEGIADO: string;
  DNI: string;
  ESTADO: string;
  FECHA_ULTIMO_PAGO: string | null;
}

const DOCS_PDF = [
  { key: 'fichaAdmisibilidad', label: 'Ficha de Admisibilidad' },
  { key: 'solicitudAsignacion', label: 'Solicitud de Asignación' },
  { key: 'cartaRemision', label: 'Carta de Remisión' },
  { key: 'memorando', label: 'Memorándum' },
  { key: 'ordenPago', label: 'Orden de Pago' },
  { key: 'declaracionJurada', label: 'Declaración Jurada' },
  { key: 'actaDefuncion', label: 'Acta de Defunción' },
  { key: 'otrosDocumentos', label: 'Otros / Documentación Completa' },
];
const DNI_KEY = 'declaracionJurada';

const MONTOS_BASE: Record<string, number> = { 'Fallecimiento': 3000, 'Accidente Grave': 2000, 'Enfermedad Terminal': 2000 };
const FORMA_PAGO_OPTIONS = ['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'];
const MAX_PDF_MB = 10;

const fmt = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('es-PE') : '-');
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

function RegistrarHistoricoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const colegiadoId = searchParams?.get('colegiadoId') || '';
  const tipoPre = searchParams?.get('tipoPre') || '';

  const [colegiado, setColegiado] = useState<ColegiadoInfo | null>(null);
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioVinculado[]>([]);
  const [tipos, setTipos] = useState<TipoBeneficioOpt[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [covidMontoTotal, setCovidMontoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tipoSeleccionado, setTipoSeleccionado] = useState('');
  const [monto, setMonto] = useState('');
  const [solicitanteId, setSolicitanteId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [expedienteNumero, setExpedienteNumero] = useState('');
  const [fechaSolicitud, setFechaSolicitud] = useState(new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [cartaNumero, setCartaNumero] = useState('');
  const [fechaDefuncion, setFechaDefuncion] = useState('');
  const [causaFallecimiento, setCausaFallecimiento] = useState('');
  const [fechaDiagnostico, setFechaDiagnostico] = useState('');
  const [diagnosticoMedico, setDiagnosticoMedico] = useState('');
  const [fechaAccidente, setFechaAccidente] = useState('');
  const [descripcionAccidente, setDescripcionAccidente] = useState('');
  const [cartaFecha, setCartaFecha] = useState('');
  const [memorandoNumero, setMemorandoNumero] = useState('');
  const [memorandoFecha, setMemorandoFecha] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [banco, setBanco] = useState('');
  const [catalogoCartas, setCatalogoCartas] = useState<any[]>([]);
  const [catalogoMemorandos, setCatalogoMemorandos] = useState<any[]>([]);

  const [docsPresentados, setDocsPresentados] = useState<Record<string, boolean>>({
    fichaAdmisibilidad: false, solicitudAsignacion: false, cartaRemision: false, memorando: false, ordenPago: false, declaracionJurada: false, actaDefuncion: false, otrosDocumentos: false,
  });
  const [docsPdf, setDocsPdf] = useState<Record<string, { base64: string; size: number } | null>>({
    fichaAdmisibilidad: null, solicitudAsignacion: null, cartaRemision: null, memorando: null, ordenPago: null, declaracionJurada: null, actaDefuncion: null, otrosDocumentos: null,
  });
  const [dniDeclaracion, setDniDeclaracion] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [showHistorial, setShowHistorial] = useState(false);
  const [colegiadoFallecido, setColegiadoFallecido] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setIsAdmin(user?.rol === 'ADMINISTRADOR');
  }, []);

  const handlePdfUpload = (key: string, file: File) => {
    const label = DOCS_PDF.find((d) => d.key === key)?.label || 'Documento';
    if (file.type !== 'application/pdf') { showConfirmMessage('error', `${label}: formato inválido`, 'Solo se permiten archivos PDF'); return; }
    if (file.size > MAX_PDF_MB * 1024 * 1024) { showConfirmMessage('error', `${label}: excede ${MAX_PDF_MB}MB`, `Archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setDocsPdf((prev) => ({ ...prev, [key]: { base64, size: file.size } }));
      setDocsPresentados((prev) => ({ ...prev, [key]: true }));
      showConfirmMessage('success', `${label} cargado`, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
    };
    reader.readAsDataURL(file);
  };

  const handleDeclaracionBeneficiario = (id: string, file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Declaración jurada: formato inválido', 'Solo se permiten archivos PDF (.pdf)');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Declaración jurada: archivo demasiado grande', `Máximo: ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setBeneficiarios((prev) => prev.map((b) => (b.id === id ? { ...b, declaracionJurada: base64, declaracionSize: file.size } : b)));
      showConfirmMessage('success', 'Declaración jurada cargada', `Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    };
    reader.readAsDataURL(file);
  };

  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);
  const abrirPdfBase64 = (base64: string, nombre: string) => setPdfViewer({ base64, nombre });

  const handleOrdenPagoBeneficiario = (id: string, file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Orden de pago: formato inválido', 'Solo se permiten archivos PDF (.pdf)');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Orden de pago: archivo demasiado grande', `Máximo: ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setBeneficiarios((prev) => prev.map((b) => (b.id === id ? { ...b, ordenPago: base64, ordenPagoSize: file.size } : b)));
      showConfirmMessage('success', 'Orden de pago cargada', `Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!colegiadoId) { setLoading(false); return; }
    let activo = true;
    Promise.all([
      api.get(`/fam/personas/${colegiadoId}`),
      api.get('/tipos-beneficio-config?activos=true'),
      api.get('/cartas'),
      api.get('/memorandos'),
      api.get(`/fam-beneficios?colegiadoId=${colegiadoId}&limit=100`),
    ]).then(([colRes, tiposRes, cartasRes, memRes, histRes]) => {
      if (!activo) return;
      const col = colRes.data;
      setColegiado(col);
      const benesMapeados = (col.beneficiarios || []).map((b: any) => ({
        id: b.FAM_ID ? String(b.FAM_ID) : (b.id || ''),
        nombre: b.NOMBRE_BENEFICIARIO || b.nombre || '',
        dni: b.DNI || b.dni || null,
        declaracionJuradaDni: b.DNI || b.dni || '',
        parentesco: b.PARENTESCO || b.parentesco || 'Otros',
        porcentajeAsignado: Math.min(100, Math.max(0, b.PORCENTAJE != null ? Number(b.PORCENTAJE) : (b.porcentaje || 0))),
      }));
      setBeneficiarios(benesMapeados);
      if (benesMapeados.length > 0) setSolicitanteId(benesMapeados[0].id);

      const filtrados = (tiposRes.data || []).filter((t: any) => {
        const n = (t.nombre || '').toUpperCase();
        return n.includes('FALLECIMIENTO') || n.includes('ACCIDENTE') || n.includes('ENFERMEDAD') || n.includes('TERMINAL');
      });
      setTipos(filtrados);
      setCatalogoCartas(Array.isArray(cartasRes.data) ? cartasRes.data : []);
      setCatalogoMemorandos(Array.isArray(memRes.data) ? memRes.data : []);

      if (tipoPre) {
        const tipoMatch = filtrados.find((t: any) => (t.nombre || '').toUpperCase().includes(tipoPre.toUpperCase()));
        if (tipoMatch) setTipoSeleccionado(String(tipoMatch.id));
      }

      const expedientes = histRes.data?.data || [];
      setHistorial(expedientes);
      const tieneFallecimiento = expedientes.some(
        (e: any) =>
          (e.tipoBeneficio?.codigo === 'FALLECIMIENTO' ||
           (e.tipoBeneficio?.nombre || '').toUpperCase().includes('FALLECIMIENTO') ||
           e.fechaDefuncion != null ||
           e.actaDefuncion != null) &&
          e.estado !== 'RECHAZADA'
      );
      if (tieneFallecimiento) {
        setColegiadoFallecido(true);
        setError('No se pueden registrar más beneficios porque el colegiado está fallecido.');
      }
      let covidTotal = 0;
      expedientes.forEach((e: any) => {
        if (e.tipoBeneficio?.codigo === 'COVID_19' && (e.estado === 'PAGADA' || e.estado === 'APROBADA')) covidTotal += e.monto || 0;
      });
      setCovidMontoTotal(covidTotal);
    }).catch(() => {}).finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [colegiadoId]);

  const getDisponible = useCallback((nombreTipo: string): number => {
    const nombre = nombreTipo.toUpperCase();
    const esEnfTerminal = nombre.includes('ENFERMEDAD') || nombre.includes('TERMINAL');
    const esAccidente = nombre.includes('ACCIDENTE');
    const esFallecimiento = nombre.includes('FALLECIMIENTO');
    const cfgKey = esFallecimiento ? 'FALLECIMIENTO' : esAccidente ? 'ACC_GRAVE' : 'ENF_TERMINAL';
    const base = cfgKey === 'FALLECIMIENTO' ? 3000 : 2000;
    const pagado = historial
      .filter((h) => {
        const codigo = (h.tipoBeneficio?.codigo || '').toUpperCase();
        return (cfgKey === 'FALLECIMIENTO' && codigo.includes('FALLECIMIENTO')) ||
               (cfgKey === 'ACC_GRAVE' && codigo.includes('ACCIDENTE')) ||
               (cfgKey === 'ENF_TERMINAL' && (codigo.includes('ENFERMEDAD') || codigo.includes('TERMINAL')));
      })
      .filter((h) => h.estado === 'PAGADA' || h.estado === 'APROBADA')
      .reduce((sum, h) => sum + (h.monto || 0), 0);
    return Math.max(0, base - (esEnfTerminal ? covidMontoTotal : 0) - pagado);
  }, [historial, covidMontoTotal]);

  const getTipoNombre = (tipoId: string) => tipos.find((t) => String(t.id) === String(tipoId))?.nombre || '';

  useEffect(() => {
    if (!tipoSeleccionado) return;
    setMonto(String(getDisponible(getTipoNombre(tipoSeleccionado))));
  }, [tipoSeleccionado, getDisponible]);

  const tipoActual = tipos.find((t) => String(t.id) === String(tipoSeleccionado));
  const nombreTipo = tipoActual?.nombre?.toUpperCase() || '';
  const esEnfTerminal = nombreTipo.includes('ENFERMEDAD') || nombreTipo.includes('TERMINAL');
  const esFallecimiento = nombreTipo.includes('FALLECIMIENTO');
  const esAccidenteGrave = nombreTipo.includes('ACCIDENTE');
  const descuento = esEnfTerminal ? covidMontoTotal : 0;
  const montoNumerico = parseFloat(monto) || 0;
  const montoFinal = Math.max(0, montoNumerico - descuento);
  const multiplesBeneficiarios = beneficiarios.length > 1;
  const docsRequeridos = DOCS_PDF.filter(({ key }) => {
    if (key === 'actaDefuncion' && !esFallecimiento) return false;
    if (multiplesBeneficiarios && (key === 'ordenPago' || key === 'declaracionJurada')) return false;
    return true;
  });
  const todosPresentados = docsRequeridos.every(({ key }) => docsPresentados[key]);

  const validar = (): string => {
    if (colegiadoFallecido) return 'No se pueden registrar más beneficios porque el colegiado está fallecido.';
    if (!tipoSeleccionado) return 'Seleccione un tipo de beneficio';
    if (!montoNumerico || montoNumerico <= 0) return 'Ingrese un monto válido';
    if (!fechaSolicitud) return 'Ingrese la fecha de recepción';
    const disponible = getDisponible(getTipoNombre(tipoSeleccionado));
    if (montoNumerico > disponible) return `El monto ${fmtMonto(montoNumerico)} excede el disponible (${fmtMonto(disponible)})`;
    const dni = dniDeclaracion.trim();
    if (dni && !/^\d{8}$/.test(dni)) return 'El DNI de la Declaración Jurada debe tener exactamente 8 dígitos';
    for (const b of beneficiarios) {
      const dniDecl = (b.declaracionJuradaDni || '').trim() || (b.dni || '').trim();
      if (dniDecl && !/^\d{8}$/.test(dniDecl)) return `El DNI del declarante de ${b.nombre} debe tener 8 dígitos`;
      if (b.declaracionJurada && !dniDecl) return `Indique el DNI del declarante de ${b.nombre}`;
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
        colegiadoId, estado: 'PAGADA',
        beneficiarios: beneficiarios.map((b) => ({
          id: b.id, nombre: b.nombre, dni: b.dni || undefined,
          parentesco: b.parentesco, porcentaje: b.porcentajeAsignado,
          ...(b.declaracionJurada && { declaracionJurada: b.declaracionJurada }),
          ...((b.declaracionJuradaDni?.trim() || (b.dni || '').trim()) && {
            declaracionJuradaDni: b.declaracionJuradaDni?.trim() || (b.dni || '').trim(),
          }),
          ...(b.ordenPago && { ordenPago: b.ordenPago }),
        })),
        tipoBeneficioConfigId: Number(tipoSeleccionado), monto: montoNumerico,
        moneda: 'PEN', modalidadBeneficio: 'monto_compartido',
        fechaSolicitud, fechaPago: fechaPago || undefined,
        documentacionCompleta: todosPresentados,
        documentacionObservacion: !todosPresentados ? 'Documentación pendiente' : undefined,
        expedienteNumero: expedienteNumero.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        cartaNumero: cartaNumero || undefined, cartaFecha: cartaFecha || undefined,
        memorandoNumero: memorandoNumero || undefined, memorandoFecha: memorandoFecha || undefined,
        formaPago: formaPago || undefined, banco: banco || undefined,
        solicitanteBeneficiarioId: solicitanteId || undefined,
        solicitanteNombre: solicitante?.nombre || undefined,
        solicitanteDni: solicitante?.dni || undefined,
        ...(esFallecimiento && { fechaDefuncion: fechaDefuncion || undefined, causaFallecimiento: causaFallecimiento || undefined }),
        ...(esEnfTerminal && { fechaDiagnostico: fechaDiagnostico || undefined, diagnosticoMedico: diagnosticoMedico || undefined }),
        ...(esAccidenteGrave && { fechaAccidente: fechaAccidente || undefined, descripcionAccidente: descripcionAccidente || undefined }),
      };
      DOCS_PDF.forEach(({ key }) => { if (docsPdf[key]?.base64) body[key] = docsPdf[key]!.base64; });
      if (body.declaracionJurada && dniDeclaracion.trim()) body.declaracionJuradaDni = dniDeclaracion.trim();
      await api.post('/fam-registros', body);
      showConfirmMessage('success', 'Beneficio registrado correctamente');
      setTimeout(() => router.push('/dashboard/fam/expedientes'), 1200);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Error al registrar';
      setError(msg); showConfirmMessage('error', msg);
    } finally { setGuardando(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-text-sec">Cargando datos del colegiado...</span>
      </div>
    );
  }

  if (!colegiadoId || !colegiado) {
    return (
      <div className="text-center py-12">
        <p className="text-text-sec">No se especificó un colegiado válido.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary hover:underline text-sm">Volver</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header compacto — una sola línea */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()} className="text-text-sec hover:text-primary transition-colors" title="Volver">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-bold text-primary">{colegiado.NUM_COLEGIATURA}</span>
        <span className="text-sm text-text-main font-medium">{colegiado.NOMBRE_COLEGIADO}</span>
        <span className="text-xs text-text-sec">DNI: {colegiado.DNI}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colegiado.ESTADO === 'HABILITADO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{colegiado.ESTADO}</span>
        <span className="text-xs text-text-sec">Último pago: {fmt(colegiado.FECHA_ULTIMO_PAGO)}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowHistorial(!showHistorial)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showHistorial ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary/30 hover:bg-primary/5'}`}>
            <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Historial ({historial.length})
          </button>
        </div>
      </div>

      {colegiadoFallecido && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-sm">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <h4 className="font-bold text-red-800">Colegiado Fallecido - Registro Bloqueado</h4>
            <p className="text-xs text-red-700 mt-0.5 font-medium">
              No se pueden registrar más beneficios porque el colegiado está fallecido.
            </p>
          </div>
        </div>
      )}

      {/* Panel de historial colapsable */}
      {showHistorial && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-main">Historial de Beneficios del Colegiado</h3>
            <span className="text-xs text-text-sec">{historial.length} registros</span>
          </div>
          {historial.length > 0 ? (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold text-text-sec">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-sec">Tipo</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-sec">Monto</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-sec">Descuento</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-sec">Final</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-sec">Solicitante</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-sec">N.° Expediente</th>
                    <th className="px-3 py-2 text-center font-semibold text-text-sec">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historial.slice().sort((a: any, b: any) => new Date(b.fechaSolicitud || b.fecha).getTime() - new Date(a.fechaSolicitud || a.fecha).getTime()).map((h: any) => (
                    <tr key={h.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2">{fmt(h.fechaSolicitud || h.fecha)}</td>
                      <td className="px-3 py-2 font-medium">{h.tipoBeneficio?.nombre || h.tipoNombre || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtMonto(h.monto)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{h.descuentoCovid > 0 ? `- ${fmtMonto(h.descuentoCovid)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtMonto(h.montoFinal ?? h.monto)}</td>
                      <td className="px-3 py-2">{h.solicitanteNombre || '—'}</td>
                      <td className="px-3 py-2 font-mono">{h.expedienteNumero || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.estado === 'PAGADA' ? 'bg-green-100 text-green-700' : h.estado === 'APROBADA' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{h.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-sec text-center py-6">Sin beneficios registrados</p>
          )}
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Columna izquierda — Formulario completo */}
        <div className="xl:col-span-8 space-y-5 min-w-0">

          {/* 1. Selección de tipo */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">1</div>
              Tipo de Beneficio
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['Fallecimiento', 'Accidente Grave', 'Enfermedad Terminal'] as const).map((nombre) => {
                const disponible = getDisponible(nombre);
                const agotado = disponible <= 0;
                const seleccionado = getTipoNombre(tipoSeleccionado) === nombre;
                return (
                  <button key={nombre} type="button" disabled={agotado}
                    onClick={() => { const tipo = tipos.find((t) => t.nombre === nombre); if (tipo && !agotado) setTipoSeleccionado(String(tipo.id)); }}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${seleccionado ? 'border-primary bg-primary/5 shadow-md' : agotado ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-border hover:border-primary/40 hover:shadow-sm cursor-pointer'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-text-main">{nombre}</span>
                      {seleccionado && <span className="px-1.5 py-0.5 bg-primary text-white text-[9px] font-bold rounded">ACTIVO</span>}
                    </div>
                    <p className="text-xs text-text-sec">Base: {fmtMonto(MONTOS_BASE[nombre] || 0)}</p>
                    {esEnfTerminal && nombre === 'Enfermedad Terminal' && covidMontoTotal > 0 && <p className="text-[10px] text-red-600">COVID: -{fmtMonto(covidMontoTotal)}</p>}
                    <p className={`text-lg font-bold mt-1 ${agotado ? 'text-red-500' : 'text-green-700'}`}>{fmtMonto(disponible)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Datos del beneficio — siempre visible */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">2</div>
              Datos del Beneficio
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Monto (S/) *</label>
                <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                {descuento > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <span className="text-red-600">COVID: -{fmtMonto(descuento)}</span>
                    <span className="ml-2 font-bold text-green-700">= {fmtMonto(montoFinal)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Solicitante *</label>
                <select value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {beneficiarios.length === 0 && <option value="">Sin beneficiarios</option>}
                  {beneficiarios.map((b) => <option key={b.id} value={b.id}>{b.nombre} — {b.parentesco}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">N.° Expediente</label>
                <input type="text" value={expedienteNumero} onChange={(e) => setExpedienteNumero(e.target.value)}
                  placeholder="Ej: 2300-2022" className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* 2b. Declaraciones juradas por beneficiario */}
          {beneficiarios.length > 0 && (
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">2b</div>
                Documentos por Beneficiario
              </h3>
              <div className="space-y-2">
                {beneficiarios.map((b) => (
                  <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-lg px-3 py-2.5 border-border bg-white">
                    <div className="min-w-0 sm:w-64">
                      <p className="text-sm font-medium text-text-main truncate">{b.nombre}</p>
                      <p className="text-[10px] text-text-sec">DNI: {b.dni || '—'} · {b.porcentajeAsignado}%</p>
                    </div>
                    {b.declaracionJurada ? (
                      <>
                        <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          ✓ {((b.declaracionSize || 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button type="button" onClick={() => abrirPdfBase64(b.declaracionJurada!, `Declaración jurada - ${b.nombre}`)}
                          className="text-xs text-primary hover:underline font-medium">Ver</button>
                        <label className="cursor-pointer text-xs text-text-sec hover:underline">
                          Reemplazar
                          <input type="file" accept="application/pdf,.pdf" className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) handleDeclaracionBeneficiario(b.id, e.target.files[0]); }} />
                        </label>
                      </>
                    ) : (
                      <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline">
                        + Cargar PDF
                        <input type="file" accept="application/pdf,.pdf" className="hidden"
                          onChange={(e) => { if (e.target.files?.[0]) handleDeclaracionBeneficiario(b.id, e.target.files[0]); }} />
                      </label>
                    )}
                    <label className="inline-flex items-center gap-1.5 text-xs text-text-sec sm:ml-auto">
                      DNI declarante
                      <input type="text" inputMode="numeric" maxLength={8}
                        value={b.declaracionJuradaDni || ''}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          setBeneficiarios((prev) => prev.map((x) => (x.id === b.id ? { ...x, declaracionJuradaDni: valor } : x)));
                        }}
                        placeholder="8 dígitos" className="w-24 px-2 py-1.5 border border-border rounded-lg text-sm" />
                    </label>
                    <div className="flex items-center gap-2 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[10px] font-semibold text-text-sec uppercase">Orden de pago</span>
                      {b.ordenPago ? (
                        <>
                          <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            ✓ {((b.ordenPagoSize || 0) / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <button type="button" onClick={() => abrirPdfBase64(b.ordenPago!, `Orden de pago - ${b.nombre}`)}
                            className="text-xs text-primary hover:underline font-medium">Ver</button>
                          <label className="cursor-pointer text-xs text-text-sec hover:underline">
                            Reemplazar
                            <input type="file" accept="application/pdf,.pdf" className="hidden"
                              onChange={(e) => { if (e.target.files?.[0]) handleOrdenPagoBeneficiario(b.id, e.target.files[0]); }} />
                          </label>
                        </>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          + Cargar PDF
                          <input type="file" accept="application/pdf,.pdf" className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) handleOrdenPagoBeneficiario(b.id, e.target.files[0]); }} />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Fechas */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">3</div>
              Fechas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">F. Recepción *</label>
                <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">F. Pago</label>
                <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div></div>
            </div>
          </div>

          {/* 4. Documentación */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">4</div>
              Documentación (PDF, máx. {MAX_PDF_MB}MB c/u)
              <span className="ml-auto text-xs font-normal text-text-sec">{docsRequeridos.filter(({ key }) => docsPresentados[key]).length}/{docsRequeridos.length}</span>
            </h3>
            <div className="space-y-2">
              {docsRequeridos.map(({ key, label }) => {
                const presentado = docsPresentados[key];
                const doc = docsPdf[key];
                return (
                  <div key={key} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 transition-colors ${presentado ? 'border-border bg-white' : 'border-amber-300 bg-amber-50'}`}>
                    <span className="text-sm text-text-main w-48">{label}</span>
                    {key === DNI_KEY && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-text-sec">
                        DNI
                        <input
                          type="text" inputMode="numeric" maxLength={8}
                          value={dniDeclaracion}
                          onChange={(e) => setDniDeclaracion(e.target.value.replace(/\D/g, ''))}
                          placeholder="8 dígitos"
                          className="w-28 px-2 py-1.5 border border-border rounded-lg text-sm"
                        />
                      </label>
                    )}
                    {doc ? (
                      <>
                        <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ {(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button type="button" onClick={() => abrirPdfBase64(doc.base64, label)} className="text-xs text-primary hover:underline font-medium">Ver</button>
                        <button type="button" onClick={() => { setDocsPdf((p) => ({ ...p, [key]: null })); setDocsPresentados((p) => ({ ...p, [key]: false })); }} className="text-xs text-red-500 hover:text-red-700">Quitar</button>
                      </>
                    ) : (
                      <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        Cargar PDF
                        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handlePdfUpload(key, e.target.files[0]); }} />
                      </label>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] text-text-sec min-w-[60px]">{presentado ? 'Presentado' : 'Pendiente'}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={presentado}
                        aria-label={`${label}: ${presentado ? 'presentado' : 'pendiente'}`}
                        onClick={() => setDocsPresentados((p) => ({ ...p, [key]: !p[key] }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${presentado ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${presentado ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Datos Administrativos */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">5</div>
              Datos Administrativos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">N.° Carta</label>
                <select value={cartaNumero} onChange={(e) => {
                  const carta = catalogoCartas.find((c: any) => c.numero === e.target.value);
                  setCartaNumero(e.target.value);
                  setCartaFecha(carta?.fecha ? new Date(carta.fecha).toISOString().slice(0, 10) : '');
                }} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">-- Seleccionar --</option>
                  {catalogoCartas.map((c: any) => <option key={c.id} value={c.numero}>{c.numero}{c.referencia ? ` — ${c.referencia}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">F. Carta</label>
                <input type="date" value={cartaFecha} onChange={(e) => setCartaFecha(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div></div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">N.° Memorándum</label>
                <select value={memorandoNumero} onChange={(e) => {
                  const mem = catalogoMemorandos.find((m: any) => m.numero === e.target.value);
                  setMemorandoNumero(e.target.value);
                  setMemorandoFecha(mem?.fecha ? new Date(mem.fecha).toISOString().slice(0, 10) : '');
                }} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">-- Seleccionar --</option>
                  {catalogoMemorandos.map((m: any) => <option key={m.id} value={m.numero}>{m.numero}{m.asunto ? ` — ${m.asunto}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">F. Memorándum</label>
                <input type="date" value={memorandoFecha} onChange={(e) => setMemorandoFecha(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div></div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Forma de Pago</label>
                <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">--</option>
                  {FORMA_PAGO_OPTIONS.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Banco</label>
                <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div></div>
            </div>
          </div>

          {/* 5b. Datos específicos por tipo */}
          {(esFallecimiento || esEnfTerminal || esAccidenteGrave) && (
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">5b</div>
                {esFallecimiento ? 'Datos del Fallecimiento' : esEnfTerminal ? 'Datos del Diagnóstico' : 'Datos del Accidente'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {esFallecimiento && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Fecha de Defunción</label>
                      <input type="date" value={fechaDefuncion} onChange={(e) => setFechaDefuncion(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Causa de Fallecimiento</label>
                      <input type="text" value={causaFallecimiento} onChange={(e) => setCausaFallecimiento(e.target.value)}
                        placeholder="Causa del deceso" className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </>
                )}
                {esEnfTerminal && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Fecha de Diagnóstico</label>
                      <input type="date" value={fechaDiagnostico} onChange={(e) => setFechaDiagnostico(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Diagnóstico Médico</label>
                      <input type="text" value={diagnosticoMedico} onChange={(e) => setDiagnosticoMedico(e.target.value)}
                        placeholder="Nombre del diagnóstico" className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </>
                )}
                {esAccidenteGrave && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Fecha del Accidente</label>
                      <input type="date" value={fechaAccidente} onChange={(e) => setFechaAccidente(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Descripción del Accidente</label>
                      <input type="text" value={descripcionAccidente} onChange={(e) => setDescripcionAccidente(e.target.value)}
                        placeholder="Descripción breve" className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 6. Observaciones */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">6</div>
              Observaciones
            </h3>
            <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas adicionales sobre el beneficio..."
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Botones */}
          <div className="flex justify-between items-center pb-6">
            <div className="text-xs text-text-sec">
              {!todosPresentados && <span className="text-amber-600">⚠  {docsRequeridos.filter(({ key }) => !docsPresentados[key]).length} documentos pendientes</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.back()} className="px-5 py-2.5 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={guardar} disabled={guardando || colegiadoFallecido}
                className="px-7 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors shadow-md">
                {guardando && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                Registrar Beneficio
              </button>
            </div>
          </div>
        </div>

        {/* Columna derecha — Resumen */}
        <div className="xl:col-span-4 space-y-4 min-w-0">
          <div className="bg-white border border-border rounded-lg p-4 sticky top-4 space-y-3">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">Resumen</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-text-sec">Beneficio</span><span className="font-semibold">{getTipoNombre(tipoSeleccionado) || '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Monto base</span><span className="font-semibold">{fmtMonto(montoNumerico)}</span></div>
              {descuento > 0 && <div className="flex justify-between"><span className="text-text-sec">Desc. COVID</span><span className="font-semibold text-red-600">-{fmtMonto(descuento)}</span></div>}
              {descuento > 0 && <div className="flex justify-between border-t border-border pt-1"><span className="text-text-sec font-semibold">Monto final</span><span className="font-bold text-green-700">{fmtMonto(montoFinal)}</span></div>}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between"><span className="text-text-sec">Solicitante</span><span className="font-medium text-right truncate max-w-[140px]">{beneficiarios.find((b) => b.id === solicitanteId)?.nombre || '—'}</span></div>
              </div>
              <div className="flex justify-between"><span className="text-text-sec">Documentos</span><span className={`font-medium ${todosPresentados ? 'text-green-600' : 'text-amber-600'}`}>{docsRequeridos.filter(({ key }) => docsPresentados[key]).length}/{docsRequeridos.length}</span></div>
            </div>
          </div>

          {/* Disponibles por tipo */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Disponibles</h4>
            <div className="space-y-1.5">
              {(['Fallecimiento', 'Accidente Grave', 'Enfermedad Terminal'] as const).map((nombre) => {
                const disp = getDisponible(nombre);
                const sel = getTipoNombre(tipoSeleccionado) === nombre;
                return (
                  <div key={nombre} className={`flex justify-between items-center py-1 px-2 rounded text-xs ${sel ? 'bg-primary/5' : ''}`}>
                    <span className={sel ? 'font-semibold text-primary' : 'text-text-sec'}>{nombre}</span>
                    <span className={`font-bold ${disp <= 0 ? 'text-red-500' : 'text-green-700'}`}>{fmtMonto(disp)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Beneficiarios */}
          {beneficiarios.length > 0 && (
            <div className="bg-white border border-border rounded-lg p-4">
              <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Beneficiarios ({beneficiarios.length})</h4>
              <div className="space-y-1.5">
                {beneficiarios.map((b) => (
                  <div key={b.id} className="flex justify-between items-center text-xs">
                    <span className="text-text-main truncate max-w-[120px]">{b.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-text-sec">{b.parentesco}</span>
                      <span className="font-semibold">{b.porcentajeAsignado}%</span>
                      {solicitanteId === b.id && <span className="px-1 py-0.5 bg-primary text-white text-[8px] font-bold rounded">SOLICITA</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COVID info */}
          {covidMontoTotal > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">COVID-19</h4>
              <p className="text-sm font-semibold text-amber-700">{fmtMonto(covidMontoTotal)}</p>
              <p className="text-[10px] text-amber-600 mt-1">Se descuenta de Enfermedad Terminal</p>
            </div>
          )}
        </div>
      </div>

      {pdfViewer && (
        <PdfViewerModal base64={pdfViewer.base64} nombre={pdfViewer.nombre} onClose={() => setPdfViewer(null)} />
      )}
    </div>
  );
}

export default function RegistrarHistoricoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-text-sec">Cargando...</span>
      </div>
    }>
      <RegistrarHistoricoContent />
    </Suspense>
  );
}
