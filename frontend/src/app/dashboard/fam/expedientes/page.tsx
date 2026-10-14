'use client';

import { useState, useEffect, useCallback, useMemo, Fragment, ReactNode } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ReporteEntregas from '@/components/fam/ReporteEntregas';
import DuplicadosPanel from '@/components/fam/DuplicadosPanel';

interface Expediente {
  id: string;
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
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
  descuentoCovid: number | null;
  montoFinal: number | null;
}

interface ColegiadoGrupo {
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  expedientes: Expediente[];
  totalMonto: number;
  totalMontoFinal: number;
  totalRecibido: number;
  totalPagados: number;
  ultimoEstado: string;
  ultimaFecha: string;
  ultimaFechaPago: string | null;
  docsIncompletos: boolean;
  conteoEstados: Record<string, number>;
  beneficiariosUnicos: { nombre: string; dni: string }[];
}

interface TipoBeneficioOpt {
  id: number;
  nombre: string;
  descripcion?: string;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  EN_REVISION: 'bg-blue-100 text-blue-700',
  APROBADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
  PAGADA: 'bg-emerald-600 text-white',
};

const ESTADO_DOT: Record<string, string> = {
  PENDIENTE: 'bg-amber-500',
  EN_REVISION: 'bg-blue-500',
  APROBADA: 'bg-green-500',
  RECHAZADA: 'bg-red-500',
  PAGADA: 'bg-emerald-500',
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  PAGADA: 'Pagada',
};

const ESTADO_LABELS_PLURAL: Record<string, string> = {
  PENDIENTE: 'pendientes',
  EN_REVISION: 'en revisión',
  APROBADA: 'aprobadas',
  RECHAZADA: 'rechazadas',
  PAGADA: 'pagados',
};

const ESTADO_OPTIONS = ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'PAGADA'];

const fmtFecha = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const ICONS: Record<string, ReactNode> = {
  reloj: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  persona: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  ),
  alerta: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
  ),
  documento: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
};

const TH_CLS = 'px-4 py-3 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider';

export default function ExpedientesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'historial' | 'todos' | 'reporte' | 'duplicados'>('historial');
  const [puedeCrear, setPuedeCrear] = useState(false);

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [docsFiltro, setDocsFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [tipos, setTipos] = useState<TipoBeneficioOpt[]>([]);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const user = getCurrentUser();
    setPuedeCrear(!!user && user.rol !== 'AUDITOR');
    api.get('/tipos-beneficio-config', { params: { activos: 'true' } })
      .then(({ data }) => setTipos(Array.isArray(data) ? data : []))
      .catch(() => setTipos([]));
    api.get('/expediente-sla/dashboard')
      .then(({ data }) => setDashboard(data))
      .catch(() => {});
  }, []);

  const fetchExpedientes = useCallback(async () => {
    if (tab === 'reporte' || tab === 'duplicados') { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (tab === 'historial') params.estado = 'PAGADA';
      else if (estadoFiltro) params.estado = estadoFiltro;
      if (search) params.search = search;
      if (tipoFiltro) params.tipoBeneficioId = tipoFiltro;
      if (docsFiltro) params.documentacionCompleta = docsFiltro;
      if (tab === 'todos' && fechaDesde) params.fechaDesde = fechaDesde;
      if (tab === 'todos' && fechaHasta) params.fechaHasta = fechaHasta;

      const { data } = await api.get('/fam-beneficios', { params });
      setExpedientes(Array.isArray(data?.data) ? data.data : []);
      setTotal(data?.meta?.total || 0);
    } catch {
      setExpedientes([]);
      setError('Error al cargar los expedientes. Verifique su sesión.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, tab, search, tipoFiltro, estadoFiltro, docsFiltro, fechaDesde, fechaHasta]);

  useEffect(() => { fetchExpedientes(); }, [fetchExpedientes]);
  useEffect(() => { setPage(1); setExpandidos(new Set()); }, [tab, search, tipoFiltro, estadoFiltro, docsFiltro, fechaDesde, fechaHasta, limit]);

  const grupos = useMemo(() => {
    const map = new Map<string, ColegiadoGrupo>();
    for (const exp of expedientes) {
      const key = exp.colegiadoId || exp.id;
      if (!map.has(key)) {
        map.set(key, {
          colegiadoId: exp.colegiadoId,
          NUM_COLEGIATURA: exp.NUM_COLEGIATURA,
          DNI: exp.DNI,
          NOMBRE_COLEGIADO: exp.NOMBRE_COLEGIADO,
          expedientes: [],
          totalMonto: 0,
          totalMontoFinal: 0,
          totalRecibido: 0,
          totalPagados: 0,
          ultimoEstado: exp.estado,
          ultimaFecha: exp.fechaSolicitud || '',
          ultimaFechaPago: null,
          docsIncompletos: false,
          conteoEstados: {},
          beneficiariosUnicos: [],
        });
      }
      const g = map.get(key)!;
      g.expedientes.push(exp);
      g.totalMonto += Number(exp.monto) || 0;
      g.totalMontoFinal += Number(exp.montoFinal ?? exp.monto) || 0;
      g.conteoEstados[exp.estado] = (g.conteoEstados[exp.estado] || 0) + 1;
      if (!exp.documentacionCompleta) g.docsIncompletos = true;
      if (exp.estado === 'PAGADA') {
        g.totalPagados += 1;
        g.totalRecibido += Number(exp.montoFinal ?? exp.monto) || 0;
        if (exp.fechaPago && (!g.ultimaFechaPago || exp.fechaPago > g.ultimaFechaPago)) {
          g.ultimaFechaPago = exp.fechaPago;
        }
      }
      const recNombre = exp.solicitanteNombre || (exp.estado === 'PAGADA' ? exp.NOMBRE_COLEGIADO : '');
      if (recNombre) {
        const recDni = exp.solicitanteDni || exp.DNI || '';
        const clave = recDni || recNombre;
        if (!g.beneficiariosUnicos.some((b) => (b.dni || b.nombre) === clave)) {
          g.beneficiariosUnicos.push({ nombre: recNombre, dni: recDni });
        }
      }
      if (exp.fechaSolicitud && exp.fechaSolicitud > g.ultimaFecha) {
        g.ultimaFecha = exp.fechaSolicitud;
      }
      const orden: Record<string, number> = { PAGADA: 5, APROBADA: 4, EN_REVISION: 3, PENDIENTE: 2, RECHAZADA: 1 };
      if ((orden[exp.estado] || 0) > (orden[g.ultimoEstado] || 0)) {
        g.ultimoEstado = exp.estado;
      }
    }
    return Array.from(map.values());
  }, [expedientes]);

  const toggleGrupo = (key: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (expandidos.size === grupos.length) {
      setExpandidos(new Set());
    } else {
      setExpandidos(new Set(grupos.map((g) => g.colegiadoId)));
    }
  };

  const resumenEstados = (grupo: ColegiadoGrupo) => {
    if (grupo.expedientes.length <= 1) return null;
    return ESTADO_OPTIONS
      .filter((e) => grupo.conteoEstados[e])
      .map((e) => `${grupo.conteoEstados[e]} ${ESTADO_LABELS_PLURAL[e]}`)
      .join(' · ');
  };

  const nombreRecibido = (grupo: ColegiadoGrupo) => {
    if (!grupo.beneficiariosUnicos.length) return null;
    if (grupo.beneficiariosUnicos.length === 1) return grupo.beneficiariosUnicos[0].nombre;
    return `+${grupo.beneficiariosUnicos.length} beneficiarios`;
  };

  const nombreRecibidoExp = (exp: Expediente) => {
    if (exp.estado !== 'PAGADA') return null;
    return exp.solicitanteNombre || exp.NOMBRE_COLEGIADO || null;
  };

  const handleExportar = async () => {
    try {
      const all: any[] = [];
      let totalPagesExport = 1;
      for (let p = 1; p <= totalPagesExport && p <= 40; p++) {
        const params: Record<string, string | number> = { page: p, limit: 100 };
        if (tab === 'historial') params.estado = 'PAGADA';
        else if (estadoFiltro) params.estado = estadoFiltro;
        if (search) params.search = search;
        if (tipoFiltro) params.tipoBeneficioId = tipoFiltro;
        if (docsFiltro) params.documentacionCompleta = docsFiltro;
        if (tab === 'todos' && fechaDesde) params.fechaDesde = fechaDesde;
        if (tab === 'todos' && fechaHasta) params.fechaHasta = fechaHasta;
        const { data } = await api.get('/fam-beneficios', { params });
        all.push(...(data?.data || []));
        totalPagesExport = data?.meta?.totalPages || 1;
        if (!data?.meta || data.meta.page >= data.meta.totalPages) break;
      }

      if (!all.length) { alert('No hay expedientes para exportar con los filtros seleccionados.'); return; }

      const ws = XLSX.utils.json_to_sheet(all.map((r) => ({
        'N.° Expediente': r.expedienteNumero || '',
        'CIP': r.NUM_COLEGIATURA,
        'DNI': r.DNI,
        'Colegiado': r.NOMBRE_COLEGIADO,
        'Tipo Beneficio': r.tipoBeneficio?.nombre || '',
        'Monto S/': Number(r.monto),
        'Descuento COVID S/': r.descuentoCovid ?? '',
        'Monto Final S/': r.montoFinal != null ? Number(r.montoFinal) : '',
        'Estado': r.estado,
        'Documentación': r.documentacionCompleta ? 'COMPLETA' : 'INCOMPLETA',
        'Solicitante': [r.solicitanteNombre, r.solicitanteDni].filter(Boolean).join(' · ') || '',
        'F. Recepción': r.fechaSolicitud ? new Date(r.fechaSolicitud).toISOString().slice(0, 10) : '',
        'F. Pago': r.fechaPago ? new Date(r.fechaPago).toISOString().slice(0, 10) : '',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expedientes');
      XLSX.writeFile(wb, `Expedientes_FAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('Error al generar el archivo Excel.');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const filtrosActivos = search || tipoFiltro || docsFiltro || (tab === 'todos' && (estadoFiltro || fechaDesde || fechaHasta));
  const desde = total > 0 ? (page - 1) * limit + 1 : 0;
  const hasta = Math.min(page * limit, total);

  const TABS = [
    { key: 'historial' as const, label: 'Historial de Entregas', desc: 'Beneficios ya pagados' },
    { key: 'todos' as const, label: 'Todos los Expedientes', desc: 'Todos los estados' },
    { key: 'reporte' as const, label: 'Reporte de Entregas', desc: 'Quién recibió y cuánto' },
    { key: 'duplicados' as const, label: 'Duplicados', desc: 'Beneficios otorgados más de una vez' },
  ];

  const kpis = dashboard ? [
    { key: 'pendientes', label: 'Mis Pendientes', value: dashboard.misTendientes || 0, sub: 'asignados a mi', icon: ICONS.reloj, tone: 'text-amber-600 bg-amber-50' },
    { key: 'sinasignar', label: 'Sin Asignar', value: dashboard.sinAsignar || 0, sub: 'sin responsable', icon: ICONS.persona, tone: 'text-blue-600 bg-blue-50' },
    { key: 'vencer', label: 'Próximos a Vencer', value: dashboard.proximosAVencer || 0, sub: `${dashboard.vencidos || 0} vencido${(dashboard.vencidos || 0) === 1 ? '' : 's'}`, icon: ICONS.alerta, tone: (dashboard.vencidos || 0) > 0 ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50' },
    { key: 'total', label: 'Total Expedientes', value: total, sub: 'registrados', icon: ICONS.documento, tone: 'text-primary bg-primary/10' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-text-main">Expedientes de Beneficio</h2>
          <p className="text-text-sec text-sm mt-0.5">Gestión, seguimiento y reporte de beneficios del FAM</p>
        </div>
        <div className="flex items-center gap-2.5">
          {(tab === 'historial' || tab === 'todos') && (
            <button onClick={handleExportar}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel
            </button>
          )}
          {puedeCrear && (
            <button onClick={() => router.push('/dashboard/fam/expedientes/nuevo')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Nuevo Expediente
            </button>
          )}
        </div>
      </div>

      {/* Dashboard cards (solo tabs de seguimiento) */}
      {dashboard && tab !== 'reporte' && tab !== 'duplicados' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((card) => (
            <div key={card.key} className="bg-white border border-border-main rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">{card.label}</p>
                  <p className="text-2xl font-bold mt-1 text-text-main">{card.value}</p>
                  <p className="text-[11px] text-text-sec mt-0.5 truncate">{card.sub}</p>
                </div>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.tone}`}>
                  {card.icon}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-5 border-b border-border-main">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2.5 px-1 text-left border-b-2 transition-colors ${tab === t.key ? 'border-primary' : 'border-transparent hover:border-gray-300'}`}>
            <span className={`block text-sm font-medium ${tab === t.key ? 'text-primary' : 'text-text-sec hover:text-text-main'}`}>{t.label}</span>
            <span className={`block text-[10px] mt-0.5 ${tab === t.key ? 'text-primary/70' : 'text-text-sec/70'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Leyenda de estados (tabs de seguimiento) */}
      {tab !== 'reporte' && tab !== 'duplicados' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-sec">
          <span className="font-semibold uppercase tracking-wider text-[10px]">Estados:</span>
          {ESTADO_OPTIONS.map((e) => (
            <span key={e} className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[e]}`} />
              {ESTADO_LABELS[e]}
            </span>
          ))}
          <span className="text-border-main">|</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Documentación completa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Documentación incompleta
          </span>
        </div>
      )}

      {tab === 'reporte' ? (
        <ReporteEntregas tipos={tipos} />
      ) : tab === 'duplicados' ? (
        <DuplicadosPanel puedeEditar={puedeCrear} />
      ) : (
        <div className="bg-white border border-border-main rounded-xl overflow-hidden shadow-sm">
          {/* Search & Filters */}
          <div className="p-4 border-b border-border-main bg-gray-50/50">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar por CIP, DNI o nombre..." value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                  className="w-full pl-10 pr-4 py-2 border border-border-main rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
              </div>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
                className="border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Todos los tipos</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              {tab === 'todos' && (
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Todos los estados</option>
                  {ESTADO_OPTIONS.map((e) => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                </select>
              )}
              <select value={docsFiltro} onChange={(e) => setDocsFiltro(e.target.value)}
                className="border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Toda documentación</option>
                <option value="SI">Documentación completa</option>
                <option value="NO">Documentación incompleta</option>
              </select>
              {tab === 'todos' && (
                <div className="flex items-center gap-1.5">
                  <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                    className="border border-border-main rounded-lg px-2.5 py-2 text-sm bg-white" />
                  <span className="text-xs text-text-sec">a</span>
                  <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                    className="border border-border-main rounded-lg px-2.5 py-2 text-sm bg-white" />
                </div>
              )}
              <button onClick={() => { setSearch(searchInput); setPage(1); }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                Buscar
              </button>
              {filtrosActivos && (
                <button onClick={() => { setSearchInput(''); setSearch(''); setTipoFiltro(''); setEstadoFiltro(''); setDocsFiltro(''); setFechaDesde(''); setFechaHasta(''); }}
                  className="px-3 py-2 text-sm text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors">
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {error && <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-border-main">
                  <th className="w-8 px-3 py-3"></th>
                  <th className={TH_CLS}>Colegiado</th>
                  <th className={TH_CLS}>CIP / DNI</th>
                  <th className={TH_CLS}>Recibido por</th>
                  <th className={TH_CLS}>Monto</th>
                  <th className={TH_CLS}>Estado</th>
                  <th className={TH_CLS}>Docs</th>
                  <th className={TH_CLS}>F. Solicitud</th>
                  <th className={TH_CLS}>F. Pago</th>
                  <th className={`${TH_CLS} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-text-sec">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Cargando expedientes...
                    </div>
                  </td></tr>
                ) : grupos.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-text-sec">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="text-sm font-medium">No se encontraron expedientes</p>
                      <p className="text-xs text-text-sec mt-1">Intente ajustar los filtros de búsqueda</p>
                    </div>
                  </td></tr>
                ) : (
                  <>
                    {/* Header resumen */}
                    <tr className="bg-blue-50/40">
                      <td colSpan={10} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-sec">
                            {grupos.length} colegiado{grupos.length !== 1 ? 's' : ''} en esta página · {total.toLocaleString('es-PE')} expediente{total !== 1 ? 's' : ''} en total
                          </span>
                          <button onClick={toggleAll}
                            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                            {expandidos.size === grupos.length ? 'Colapsar todo' : 'Expandir todo'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {grupos.map((grupo) => {
                      const expKey = grupo.colegiadoId;
                      const expandido = expandidos.has(expKey);
                      const soloUno = grupo.expedientes.length === 1;
                      const recibe = nombreRecibido(grupo);
                      const desglose = resumenEstados(grupo);

                      return (
                        <Fragment key={expKey}>
                          {/* Row principal del colegiado */}
                          <tr className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${grupo.docsIncompletos ? 'bg-red-50/30' : ''}`}
                            onClick={() => !soloUno && toggleGrupo(expKey)}>
                            <td className="px-3 py-3.5">
                              {!soloUno && (
                                <button onClick={(e) => { e.stopPropagation(); toggleGrupo(expKey); }}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
                                  aria-label={expandido ? 'Colapsar colegiado' : 'Expandir colegiado'}>
                                  <svg className={`w-4 h-4 text-text-sec transition-transform duration-200 ${expandido ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-bold text-primary">{grupo.NOMBRE_COLEGIADO?.charAt(0) || '?'}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-main truncate" title={grupo.NOMBRE_COLEGIADO}>{grupo.NOMBRE_COLEGIADO}</p>
                                  <p className="text-[10px] text-text-sec">{grupo.expedientes.length === 1 ? '1 expediente' : `${grupo.expedientes.length} expedientes`}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-sm font-semibold text-primary">{grupo.NUM_COLEGIATURA}</span>
                              <span className="block text-[10px] text-text-sec">DNI: {grupo.DNI || '—'}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {recibe ? (
                                <div className="min-w-0 max-w-[160px]">
                                  <p className="text-xs font-medium text-text-main truncate" title={grupo.beneficiariosUnicos.length === 1 ? `${grupo.beneficiariosUnicos[0].nombre}${grupo.beneficiariosUnicos[0].dni ? ` · DNI ${grupo.beneficiariosUnicos[0].dni}` : ''}` : undefined}>
                                    {recibe}
                                  </p>
                                  {grupo.totalPagados > 0 && (
                                    <p className="text-[10px] text-emerald-600 font-medium">{grupo.totalPagados} pago{grupo.totalPagados !== 1 ? 's' : ''} realizado{grupo.totalPagados !== 1 ? 's' : ''}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-text-sec">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div>
                                <span className="text-sm font-bold text-text-main">{fmtMonto(grupo.totalMonto)}</span>
                                {grupo.totalMontoFinal !== grupo.totalMonto && (
                                  <span className="block text-[10px] text-green-600 font-medium">Neto: {fmtMonto(grupo.totalMontoFinal)}</span>
                                )}
                                {grupo.totalRecibido > 0 && grupo.totalRecibido !== grupo.totalMontoFinal && (
                                  <span className="block text-[10px] text-emerald-600 font-semibold">Recibido: {fmtMonto(grupo.totalRecibido)}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ESTADO_DOT[grupo.ultimoEstado] || 'bg-gray-400'}`} />
                                <div className="min-w-0">
                                  <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${ESTADO_COLORS[grupo.ultimoEstado] || 'bg-gray-100 text-gray-700'}`}>
                                    {ESTADO_LABELS[grupo.ultimoEstado] || grupo.ultimoEstado.replace('_', ' ')}
                                  </span>
                                  {desglose && (
                                    <span className="block text-[10px] text-text-sec mt-0.5" title="Distribución de estados">{desglose}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              {grupo.docsIncompletos ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700"
                                  title={grupo.expedientes.filter((e) => !e.documentacionCompleta).map((e) => e.documentacionObservacion || e.expedienteNumero || 'Expediente').join(' | ')}>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                  Incompleta
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  Completa
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-text-sec whitespace-nowrap">{fmtFecha(grupo.ultimaFecha)}</td>
                            <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                              {grupo.ultimaFechaPago ? (
                                <span className="font-medium text-emerald-700">{fmtFecha(grupo.ultimaFechaPago)}</span>
                              ) : (
                                <span className="text-text-sec">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 justify-center">
                                {soloUno ? (
                                  <button onClick={() => router.push(`/dashboard/fam/expedientes/${grupo.expedientes[0].id}`)}
                                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Ver detalle del expediente"
                                    aria-label="Ver detalle del expediente">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  </button>
                                ) : (
                                  <>
                                    <button onClick={() => toggleGrupo(expKey)}
                                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title={expandido ? 'Colapsar historial' : 'Ver historial del colegiado'}
                                      aria-label={expandido ? 'Colapsar historial' : 'Ver historial del colegiado'}>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </button>
                                    <button onClick={() => router.push(`/dashboard/fam/expedientes/${grupo.expedientes[0].id}`)}
                                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Ver primer expediente"
                                      aria-label="Ver primer expediente">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Sub-rows: expedientes individuales (solo si expandido) */}
                          {expandido && !soloUno && grupo.expedientes.map((exp) => {
                            const recibeExp = nombreRecibidoExp(exp);
                            return (
                              <tr key={exp.id} className={`hover:bg-blue-50/30 transition-colors ${!exp.documentacionCompleta ? 'bg-red-50/20' : 'bg-gray-50/50'}`}>
                                <td className="px-3 py-2.5 pl-10">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2 pl-6">
                                    <span className="text-xs font-medium text-text-main">{exp.expedienteNumero || 'S/N'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs text-text-sec">{exp.tipoBeneficio?.nombre || '—'}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {recibeExp ? (
                                    <div className="min-w-0 max-w-[160px]">
                                      <p className="text-xs font-medium text-text-main truncate" title={exp.solicitanteDni ? `${recibeExp} · DNI ${exp.solicitanteDni}` : recibeExp}>{recibeExp}</p>
                                      {exp.solicitanteDni && <p className="text-[10px] text-text-sec">DNI: {exp.solicitanteDni}</p>}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-text-sec">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div>
                                    <span className="text-xs font-semibold text-text-main">{fmtMonto(exp.monto)}</span>
                                    {exp.montoFinal != null && exp.montoFinal !== exp.monto && (
                                      <span className="block text-[10px] text-green-600">→ {fmtMonto(exp.montoFinal)}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${ESTADO_COLORS[exp.estado] || 'bg-gray-100 text-gray-700'}`}>
                                    {ESTADO_LABELS[exp.estado] || exp.estado.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {exp.documentacionCompleta ? (
                                    <span className="text-[10px] text-green-600 font-medium" title="Documentación completa">✓</span>
                                  ) : (
                                    <span className="text-[10px] text-red-600 font-medium" title={exp.documentacionObservacion || 'Documentación incompleta'}>✗</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-[10px] text-text-sec whitespace-nowrap">{fmtFecha(exp.fechaSolicitud)}</td>
                                <td className="px-4 py-2.5 text-[10px] whitespace-nowrap">
                                  {exp.fechaPago ? (
                                    <span className="font-medium text-emerald-700">{fmtFecha(exp.fechaPago)}</span>
                                  ) : (
                                    <span className="text-text-sec">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-center">
                                    <button onClick={() => router.push(`/dashboard/fam/expedientes/${exp.id}`)}
                                      className="p-1 rounded hover:bg-primary/10 text-primary transition-colors" title="Ver detalle del expediente"
                                      aria-label="Ver detalle del expediente">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-border-main flex flex-wrap items-center justify-between gap-3 bg-gray-50/80">
            <div className="flex items-center gap-2">
              <p className="text-sm text-text-sec">{total > 0 ? `Mostrando ${desde.toLocaleString('es-PE')} a ${hasta.toLocaleString('es-PE')} de ${total.toLocaleString('es-PE')}` : 'Sin registros'}</p>
              <span className="text-xs text-text-sec">·</span>
              <span className="text-xs text-text-sec">{grupos.length} colegiado{grupos.length !== 1 ? 's' : ''} en esta página</span>
              <span className="text-xs text-text-sec ml-1">Mostrar</span>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                className="border border-border-main rounded px-2 py-1 text-xs bg-white">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1.5 text-sm border border-border-main rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'<<'}</button>
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-2 py-1.5 text-sm border border-border-main rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'<'}</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages || p < 1) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-sm rounded border ${page === p ? 'bg-primary text-white border-primary' : 'border-border-main hover:bg-white'}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="px-2 py-1.5 text-sm border border-border-main rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'>'}</button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2 py-1.5 text-sm border border-border-main rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'>>'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
