'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import PdfViewerModal from '@/components/common/PdfViewerModal';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface ExpedienteDup {
  id: string;
  expedienteNumero: string | null;
  estado: string;
  monto: number;
  montoFinal: number | null;
  fechaSolicitud: string;
  fechaPago: string | null;
}

interface DocDup {
  id: string;
  etiqueta: string;
  createdAt: string;
}

interface Duplicado {
  id: string | null;
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  tipoBeneficio: { id: string; codigo: string; nombre: string };
  estado: 'DETECTADO' | 'CONFIRMADO' | 'DESCARTADO';
  motivo: string | null;
  observaciones: string | null;
  expedientes: ExpedienteDup[];
  totalMonto: number;
  documentos: DocDup[];
  updatedAt: string | null;
}

interface TipoOpt {
  id: string;
  codigo: string;
  nombre: string;
}

interface SugerenciaColegiado {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
}

const fmtFecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMonto = (m: number) => `S/ ${Number(m || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const BADGE: Record<string, string> = {
  DETECTADO: 'bg-amber-100 text-amber-700',
  CONFIRMADO: 'bg-red-100 text-red-700',
  DESCARTADO: 'bg-slate-100 text-slate-600',
};
const BADGE_LABEL: Record<string, string> = {
  DETECTADO: 'Detectado',
  CONFIRMADO: 'Confirmado',
  DESCARTADO: 'Descartado',
};

const TH_CLS = 'px-4 py-3 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider';
const BTN_SEC =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors';
const BTN_PRI =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors';
const INPUT_CLS =
  'w-full border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30';

const MAX_PDF_MB = 10;
const claveDe = (d: Duplicado) => d.id || `${d.colegiadoId}|${d.tipoBeneficio?.id || ''}`;

const msgError = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m || fallback;
};

export default function DuplicadosPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const router = useRouter();

  const [items, setItems] = useState<Duplicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const [expandido, setExpandido] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);

  // Modal confirmar/descartar con motivo
  const [modalAccion, setModalAccion] = useState<{ item: Duplicado; estado: 'CONFIRMADO' | 'DESCARTADO' } | null>(null);
  const [modalMotivo, setModalMotivo] = useState('');
  const [modalObs, setModalObs] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Drawer de documentacion
  const [drawerItem, setDrawerItem] = useState<Duplicado | null>(null);
  const [docEtiqueta, setDocEtiqueta] = useState('');
  const [docFile, setDocFile] = useState<{ base64: string; nombre: string; size: number } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [docsLocal, setDocsLocal] = useState<DocDup[]>([]);

  // Modal registro manual
  const [modalManual, setModalManual] = useState(false);
  const [manColegiado, setManColegiado] = useState<SugerenciaColegiado | null>(null);
  const [manBusqueda, setManBusqueda] = useState('');
  const [manSugerencias, setManSugerencias] = useState<SugerenciaColegiado[]>([]);
  const [manTipo, setManTipo] = useState('');
  const [manMotivo, setManMotivo] = useState('');
  const [manObs, setManObs] = useState('');
  const [manGuardando, setManGuardando] = useState(false);
  const debounceRef = useRef<any>(null);

  const [tipos, setTipos] = useState<TipoOpt[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/fam-duplicados');
      const lista: Duplicado[] = Array.isArray(data?.data) ? data.data : [];
      setItems(lista);
      return lista;
    } catch {
      setItems([]);
      setError('Error al cargar los casos de duplicado. Verifique su sesión.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    api.get('/fam-beneficios/tipos')
      .then(({ data }) => setTipos(Array.isArray(data) ? data : []))
      .catch(() => setTipos([]));
  }, [cargar]);

  const filtrados = items.filter((d) => {
    if (estadoFiltro && d.estado !== estadoFiltro) return false;
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return (
      (d.NUM_COLEGIATURA || '').toLowerCase().includes(t) ||
      (d.DNI || '').toLowerCase().includes(t) ||
      (d.NOMBRE_COLEGIADO || '').toLowerCase().includes(t) ||
      (d.tipoBeneficio?.nombre || '').toLowerCase().includes(t) ||
      d.expedientes.some((e) => (e.expedienteNumero || '').toLowerCase().includes(t))
    );
  });

  const kpis = [
    { label: 'Detectados', value: items.filter((d) => d.estado === 'DETECTADO').length, sub: 'por revisar', tone: 'text-amber-600 bg-amber-50' },
    { label: 'Confirmados', value: items.filter((d) => d.estado === 'CONFIRMADO').length, sub: 'duplicado real', tone: 'text-red-600 bg-red-50' },
    { label: 'Descartados', value: items.filter((d) => d.estado === 'DESCARTADO').length, sub: 'falsa alarma', tone: 'text-slate-600 bg-slate-100' },
    {
      label: 'Colegiados afectados',
      value: new Set(items.filter((d) => d.estado !== 'DESCARTADO').map((d) => d.colegiadoId)).size,
      sub: `${items.reduce((s, d) => s + d.expedientes.length, 0)} expedientes involucrados`,
      tone: 'text-primary bg-primary/10',
    },
  ];

  // ---------- Acciones de estado (confirmar / descartar) ----------
  const abrirAccion = (item: Duplicado, estado: 'CONFIRMADO' | 'DESCARTADO') => {
    setModalMotivo(item.motivo || '');
    setModalObs(item.observaciones || '');
    setModalAccion({ item, estado });
  };

  const guardarAccion = async () => {
    if (!modalAccion) return;
    setGuardando(true);
    try {
      const { item, estado } = modalAccion;
      const payload: Record<string, any> = { estado };
      if (modalMotivo.trim()) payload.motivo = modalMotivo.trim();
      if (modalObs.trim()) payload.observaciones = modalObs.trim();

      if (item.id) {
        await api.put(`/fam-duplicados/${item.id}`, payload);
      } else {
        payload.colegiadoId = item.colegiadoId;
        payload.tipoBeneficioId = item.tipoBeneficio?.id;
        payload.expedienteIds = item.expedientes.map((e) => e.id);
        await api.post('/fam-duplicados', payload);
      }
      showConfirmMessage(
        'success',
        estado === 'CONFIRMADO' ? 'Caso confirmado como duplicado' : 'Caso descartado',
        item.NOMBRE_COLEGIADO || item.colegiadoId,
      );
      setModalAccion(null);
      await cargar();
    } catch (e) {
      showConfirmMessage('error', 'No se pudo actualizar el caso', msgError(e, 'Error desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Documentacion ----------
  const abrirDocs = (item: Duplicado) => {
    setDrawerItem(item);
    setDocsLocal(item.documentos || []);
    setDocEtiqueta('');
    setDocFile(null);
  };

  const handleDocFile = (file: File | null) => {
    if (!file) { setDocFile(null); return; }
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF (.pdf)');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', `Máximo permitido: ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setDocFile({ base64, nombre: file.name, size: file.size });
    };
    reader.readAsDataURL(file);
  };

  const subirDocumento = async () => {
    if (!drawerItem) return;
    if (!docFile) { showConfirmMessage('error', 'Seleccione un archivo PDF'); return; }
    const etiqueta = docEtiqueta.trim() || docFile.nombre.replace(/\.pdf$/i, '');
    setSubiendo(true);
    try {
      let idActual = drawerItem.id;
      if (!idActual) {
        const { data } = await api.post('/fam-duplicados', {
          colegiadoId: drawerItem.colegiadoId,
          tipoBeneficioId: drawerItem.tipoBeneficio?.id,
          estado: 'DETECTADO',
          expedienteIds: drawerItem.expedientes.map((e) => e.id),
          documentos: [{ etiqueta, pdfBase64: docFile.base64 }],
        });
        idActual = data?.data?.id;
        setDocsLocal(data?.data?.documentos || []);
      } else {
        const { data } = await api.post(`/fam-duplicados/${idActual}/documentos`, {
          etiqueta,
          pdfBase64: docFile.base64,
        });
        setDocsLocal((prev) => [...prev, data?.data]);
      }
      showConfirmMessage('success', 'Documento adjuntado al caso', etiqueta);
      setDocEtiqueta('');
      setDocFile(null);
      const lista = await cargar();
      const refresco = lista.find((i) => claveDe(i) === claveDe(drawerItem));
      if (refresco) setDrawerItem(refresco);
    } catch (e) {
      showConfirmMessage('error', 'No se pudo subir el documento', msgError(e, 'Error desconocido'));
    } finally {
      setSubiendo(false);
    }
  };

  const verDocumento = async (doc: DocDup) => {
    if (!drawerItem?.id) return;
    try {
      const { data } = await api.get(`/fam-duplicados/${drawerItem.id}/documentos/${doc.id}/pdf`);
      setPdfViewer({ base64: data?.data?.pdfBase64 || '', nombre: `${doc.etiqueta} · Duplicado` });
    } catch {
      showConfirmMessage('error', 'No se pudo abrir el documento');
    }
  };

  const eliminarDocumento = async (doc: DocDup) => {
    if (!drawerItem?.id) return;
    if (!confirm(`¿Eliminar el documento "${doc.etiqueta}"?`)) return;
    try {
      await api.delete(`/fam-duplicados/${drawerItem.id}/documentos/${doc.id}`);
      setDocsLocal((prev) => prev.filter((d) => d.id !== doc.id));
      showConfirmMessage('success', 'Documento eliminado');
      await cargar();
    } catch (e) {
      showConfirmMessage('error', 'No se pudo eliminar', msgError(e, 'Error desconocido'));
    }
  };

  // ---------- Registro manual ----------
  const handleManBusqueda = (value: string) => {
    setManBusqueda(value);
    setManColegiado(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/fam/autocomplete', { params: { q: value.trim() } });
          setManSugerencias(Array.isArray(data) ? data : []);
        } catch {
          setManSugerencias([]);
        }
      }, 300);
    } else {
      setManSugerencias([]);
    }
  };

  const guardarManual = async () => {
    if (!manColegiado || !manTipo || !manMotivo.trim()) {
      showConfirmMessage('error', 'Campos incompletos', 'Colegiado, tipo de beneficio y motivo son obligatorios');
      return;
    }
    setManGuardando(true);
    try {
      await api.post('/fam-duplicados', {
        colegiadoId: manColegiado.COLEGIADO_ID,
        tipoBeneficioId: manTipo,
        estado: 'CONFIRMADO',
        motivo: manMotivo.trim(),
        ...(manObs.trim() ? { observaciones: manObs.trim() } : {}),
      });
      showConfirmMessage('success', 'Caso registrado como duplicado', manColegiado.NOMBRE_COLEGIADO);
      setModalManual(false);
      setManColegiado(null);
      setManBusqueda('');
      setManTipo('');
      setManMotivo('');
      setManObs('');
      await cargar();
    } catch (e) {
      showConfirmMessage('error', 'No se pudo registrar el caso', msgError(e, 'Error desconocido'));
    } finally {
      setManGuardando(false);
    }
  };

  // ---------- Excel ----------
  const exportarExcel = () => {
    try {
      const filas = filtrados.map((d) => ({
        Colegiado: d.NOMBRE_COLEGIADO,
        CIP: d.NUM_COLEGIATURA,
        DNI: d.DNI,
        Concepto: d.tipoBeneficio?.nombre || '',
        'N° Expedientes': d.expedientes.length,
        'Expedientes': d.expedientes.map((e) => e.expedienteNumero || e.id).join(', '),
        'Monto Total (S/)': Number(d.totalMonto || 0),
        Estado: BADGE_LABEL[d.estado] || d.estado,
        Motivo: d.motivo || '',
        Documentos: d.documentos.length,
        'Ult. Actualizacion': d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('es-PE') : '',
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Duplicados');
      XLSX.writeFile(wb, `Duplicados_FAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      showConfirmMessage('error', 'Error al generar el archivo Excel');
    }
  };

  const totalPaginas = 1;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((c) => (
          <div key={c.label} className="bg-white border border-border-main rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">{c.label}</p>
            <p className="text-2xl font-bold mt-1 text-text-main">{c.value}</p>
            <p className={`text-[11px] mt-0.5 ${c.tone.split(' ')[0]}`}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-border-main rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-main bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Buscar por CIP, DNI, nombre o N.° expediente..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
                className="w-full pl-10 pr-4 py-2 border border-border-main rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos los estados</option>
              <option value="DETECTADO">Detectado</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="DESCARTADO">Descartado</option>
            </select>
            <button onClick={exportarExcel} className={BTN_SEC}>Excel</button>
            {puedeEditar && (
              <button
                onClick={() => { setModalManual(true); setManSugerencias([]); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Registrar caso
              </button>
            )}
          </div>
        </div>

        {error && <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-border-main">
                <th className="w-8 px-3 py-3"></th>
                <th className={TH_CLS}>Colegiado</th>
                <th className={TH_CLS}>Concepto</th>
                <th className={`${TH_CLS} text-center`}>Expedientes</th>
                <th className={TH_CLS}>Monto total</th>
                <th className={TH_CLS}>Estado</th>
                <th className={`${TH_CLS} text-center`}>Docs</th>
                <th className={`${TH_CLS} text-center`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-text-sec">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Cargando casos...
                    </div>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-text-sec">
                    {items.length === 0
                      ? 'No se detectaron colegiados con más de un expediente del mismo concepto.'
                      : 'No hay casos que coincidan con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((d) => {
                  const clave = claveDe(d);
                  const abierto = expandido === clave;
                  return (
                    <Fragment key={clave}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${abierto ? 'bg-primary/[0.03]' : ''}`}
                        onClick={() => setExpandido(abierto ? null : clave)}
                      >
                        <td className="px-3 py-3 text-center">
                          <svg className={`w-4 h-4 text-text-sec inline transition-transform ${abierto ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-text-main">{d.NOMBRE_COLEGIADO || d.colegiadoId}</p>
                          <p className="text-[11px] text-text-sec">CIP {d.NUM_COLEGIATURA || '—'}{d.DNI ? ` · DNI ${d.DNI}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-main">{d.tipoBeneficio?.nombre || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            {d.expedientes.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-text-main">{fmtMonto(d.totalMonto)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${BADGE[d.estado] || 'bg-slate-100 text-slate-600'}`}>
                            {BADGE_LABEL[d.estado] || d.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-text-sec">{d.documentos.length}</span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {puedeEditar && d.estado !== 'CONFIRMADO' && (
                              <button onClick={() => abrirAccion(d, 'CONFIRMADO')} className={BTN_PRI} title="Confirmar duplicado">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Confirmar
                              </button>
                            )}
                            {puedeEditar && d.estado !== 'DESCARTADO' && (
                              <button onClick={() => abrirAccion(d, 'DESCARTADO')} className={BTN_SEC} title="Descartar caso">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                Descartar
                              </button>
                            )}
                            <button onClick={() => abrirDocs(d)} className={BTN_SEC} title="Documentación del duplicado">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              Docs
                            </button>
                          </div>
                        </td>
                      </tr>
                      {abierto && (
                        <tr key={`${clave}-det`} className="bg-gray-50/70">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-text-sec">
                                <span><span className="font-semibold text-text-main">Estado:</span> {BADGE_LABEL[d.estado]}</span>
                                {d.motivo && <span><span className="font-semibold text-text-main">Motivo:</span> {d.motivo}</span>}
                                {d.observaciones && <span><span className="font-semibold text-text-main">Observaciones:</span> {d.observaciones}</span>}
                                <span className="text-border-main">|</span>
                                <span>{d.expedientes.length} expediente(s) del mismo concepto</span>
                              </div>
                              <div className="bg-white border border-border-main rounded-lg overflow-hidden">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-border-main">
                                      <th className={TH_CLS}>N.° Expediente</th>
                                      <th className={TH_CLS}>Estado</th>
                                      <th className={TH_CLS}>Monto</th>
                                      <th className={TH_CLS}>F. Solicitud</th>
                                      <th className={TH_CLS}>F. Pago</th>
                                      <th className={`${TH_CLS} text-center`}>Detalle</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-main">
                                    {d.expedientes.map((e) => (
                                      <tr key={e.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm text-text-main">{e.expedienteNumero || e.id.slice(0, 8)}</td>
                                        <td className="px-4 py-2 text-sm text-text-sec">{e.estado}</td>
                                        <td className="px-4 py-2 text-sm text-text-main">{fmtMonto(e.montoFinal ?? e.monto)}</td>
                                        <td className="px-4 py-2 text-sm text-text-sec">{fmtFecha(e.fechaSolicitud)}</td>
                                        <td className="px-4 py-2 text-sm text-text-sec">{fmtFecha(e.fechaPago)}</td>
                                        <td className="px-4 py-2 text-center">
                                          <button
                                            onClick={() => router.push(`/dashboard/fam/expedientes/${e.id}`)}
                                            className="text-xs text-primary hover:underline font-medium"
                                          >
                                            Ver expediente
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border-main bg-gray-50/50 flex items-center justify-between text-xs text-text-sec">
          <span>
            {filtrados.length} caso(s) · {items.reduce((s, d) => s + d.expedientes.length, 0)} expediente(s) involucrado(s)
          </span>
          <span>Página 1 de {totalPaginas}</span>
        </div>
      </div>

      {/* Modal confirmar / descartar */}
      {modalAccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalAccion(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-border-main" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-main">
              <h3 className="text-base font-semibold text-text-main">
                {modalAccion.estado === 'CONFIRMADO' ? 'Confirmar como duplicado' : 'Descartar caso'}
              </h3>
              <p className="text-xs text-text-sec mt-0.5">
                {modalAccion.item.NOMBRE_COLEGIADO || modalAccion.item.colegiadoId} · {modalAccion.item.tipoBeneficio?.nombre}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-sec mb-1">Motivo {modalAccion.estado === 'DESCARTADO' ? '' : '(opcional)'}</label>
                <textarea
                  value={modalMotivo}
                  onChange={(e) => setModalMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={modalAccion.estado === 'CONFIRMADO' ? 'Ej.: Se verificó doble pago al mismo colegiado' : 'Ej.: Son trámites distintos del mismo beneficiario'}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec mb-1">Observaciones (opcional)</label>
                <textarea
                  value={modalObs}
                  onChange={(e) => setModalObs(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-border-main flex justify-end gap-2">
              <button onClick={() => setModalAccion(null)} className={BTN_SEC}>Cancelar</button>
              <button
                onClick={guardarAccion}
                disabled={guardando}
                className={`${BTN_PRI} disabled:opacity-50`}
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer documentación */}
      {drawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDrawerItem(null)}>
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-border-main"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border-main flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text-main">Documentación del duplicado</h3>
                <p className="text-xs text-text-sec mt-0.5 truncate">
                  {drawerItem.NOMBRE_COLEGIADO || drawerItem.colegiadoId} · {drawerItem.tipoBeneficio?.nombre}
                </p>
              </div>
              <button onClick={() => setDrawerItem(null)} className={BTN_SEC}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Lista de documentos */}
              <div>
                <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider mb-2">
                  Documentos adjuntos ({docsLocal.length})
                </p>
                {docsLocal.length === 0 ? (
                  <p className="text-sm text-text-sec bg-gray-50 border border-border-main rounded-lg px-4 py-6 text-center">
                    Aún no hay documentación para este caso.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {docsLocal.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 bg-white border border-border-main rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-main truncate">{doc.etiqueta}</p>
                          <p className="text-[11px] text-text-sec">{fmtFecha(doc.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => verDocumento(doc)} className="text-xs text-primary hover:underline font-medium">Ver</button>
                          {puedeEditar && (
                            <button onClick={() => eliminarDocumento(doc)} className="text-xs text-red-600 hover:underline font-medium">Quitar</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Subir documento */}
              {puedeEditar && (
                <div className="border border-border-main rounded-lg p-4 bg-gray-50/50 space-y-3">
                  <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">Adjuntar nuevo documento</p>
                  {!drawerItem.id && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Al subir el primer documento se registrará el caso como detectado.
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-text-sec mb-1">Nombre / concepto</label>
                    <input
                      type="text"
                      value={docEtiqueta}
                      onChange={(e) => setDocEtiqueta(e.target.value)}
                      maxLength={100}
                      placeholder="Ej.: Informe de verificación"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-sec mb-1">Archivo PDF (máx. {MAX_PDF_MB}MB)</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handleDocFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-text-sec file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    {docFile && (
                      <p className="text-[11px] text-text-sec mt-1">
                        {docFile.nombre} · {(docFile.size / 1024 / 1024).toFixed(2)}MB
                      </p>
                    )}
                  </div>
                  <button onClick={subirDocumento} disabled={subiendo || !docFile} className={`${BTN_PRI} w-full justify-center disabled:opacity-50`}>
                    {subiendo ? 'Subiendo...' : 'Subir documento'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal registro manual */}
      {modalManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalManual(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-border-main" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-main">
              <h3 className="text-base font-semibold text-text-main">Registrar caso de duplicado</h3>
              <p className="text-xs text-text-sec mt-0.5">Marque manualmente un beneficio otorgado en duplicado</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-text-sec mb-1">Colegiado *</label>
                <input
                  type="text"
                  value={manBusqueda}
                  onChange={(e) => handleManBusqueda(e.target.value)}
                  placeholder="Buscar por CIP, DNI o nombre..."
                  className={INPUT_CLS}
                  disabled={!!manColegiado}
                />
                {manColegiado && (
                  <button
                    onClick={() => { setManColegiado(null); setManBusqueda(''); setManSugerencias([]); }}
                    className="absolute right-2 top-[30px] text-xs text-text-sec hover:text-text-main"
                  >
                    Cambiar
                  </button>
                )}
                {manSugerencias.length > 0 && !manColegiado && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-border-main rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {manSugerencias.map((s) => (
                      <li key={s.COLEGIADO_ID}>
                        <button
                          onClick={() => {
                            setManColegiado(s);
                            setManBusqueda(`${s.NUM_COLEGIATURA} - ${s.NOMBRE_COLEGIADO}`);
                            setManSugerencias([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-border-main last:border-0"
                        >
                          <span className="font-medium text-text-main">{s.NOMBRE_COLEGIADO}</span>
                          <span className="block text-[11px] text-text-sec">CIP {s.NUM_COLEGIATURA}{s.DNI ? ` · DNI ${s.DNI}` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec mb-1">Concepto / tipo de beneficio *</label>
                <select value={manTipo} onChange={(e) => setManTipo(e.target.value)} className={INPUT_CLS}>
                  <option value="">Seleccione...</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec mb-1">Motivo *</label>
                <textarea
                  value={manMotivo}
                  onChange={(e) => setManMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ej.: Se verificó doble entrega del mismo beneficio"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-sec mb-1">Observaciones (opcional)</label>
                <textarea
                  value={manObs}
                  onChange={(e) => setManObs(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-border-main flex justify-end gap-2">
              <button onClick={() => setModalManual(false)} className={BTN_SEC}>Cancelar</button>
              <button onClick={guardarManual} disabled={manGuardando} className={`${BTN_PRI} disabled:opacity-50`}>
                {manGuardando ? 'Guardando...' : 'Registrar caso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor PDF */}
      {pdfViewer && (
        <PdfViewerModal
          base64={pdfViewer.base64}
          nombre={pdfViewer.nombre}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}
