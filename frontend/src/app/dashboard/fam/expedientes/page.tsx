'use client';

import { useState, useEffect, useCallback, useMemo, Fragment, ReactNode } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ReporteEntregas from '@/components/fam/ReporteEntregas';
import DuplicadosPanel from '@/components/fam/DuplicadosPanel';
import EliminarExpedienteModal from '@/components/fam/EliminarExpedienteModal';
import ModalRegularizarSaldo from '@/components/fam/ModalRegularizarSaldo';
import EditarExpedienteModal from '@/components/fam/EditarExpedienteModal';

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
  conCartaPoder?: boolean;
  apoderadoNombre?: string | null;
  apoderadoDni?: string | null;
  apoderadoParentesco?: string | null;
  poderOtorganteNombre?: string | null;
  poderOtorganteDni?: string | null;
  poderOtorganteParentesco?: string | null;
  poderFecha?: string | null;
  poderMotivo?: string | null;
  poderChequeNumero?: string | null;
  expedienteNumero: string | null;
  descuentoCovid: number | null;
  montoFinal: number | null;
  tieneSaldoPendiente?: boolean;
  saldoPendiente?: number;
  montoTotalAsignado?: number;
  montoEntregado?: number;
  createdAt?: string;
  updatedAt?: string;
  formaPago?: string | null;
  banco?: string | null;
  bancos?: string[];
  beneficiarios?: Array<{
    beneficiarioId?: string | null;
    nombre: string;
    dni: string;
    parentesco: string;
    porcentaje: number;
    monto: number;
    banco: string;
    numeroCuenta: string;
    cci: string;
    fechaPago: string | null;
    estado: string;
    conCartaPoder?: boolean;
    apoderadoNombre?: string | null;
    apoderadoDni?: string | null;
    apoderadoParentesco?: string | null;
  }>;
}

interface ColegiadoGrupo {
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  expedientes: Expediente[];
  totalMonto: number;
  totalMontoFinal: number;
  totalMontoDado: number;
  totalRecibido: number;
  totalPagados: number;
  ultimoEstado: string;
  ultimaFecha: string;
  ultimaFechaPago: string | null;
  docsIncompletos: boolean;
  conteoEstados: Record<string, number>;
  beneficiariosUnicos: { nombre: string; dni: string }[];
  formasPago: string[];
  bancos: string[];
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

const FORMA_PAGO_LABELS: Record<string, string> = {
  DEPOSITO: 'Depósito',
  CHEQUE: 'Cheque',
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
};

const FORMA_PAGO_BADGE: Record<string, string> = {
  DEPOSITO: 'bg-blue-50 text-[#3258CA] border-blue-200',
  CHEQUE: 'bg-amber-50 text-amber-800 border-amber-200',
  TRANSFERENCIA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EFECTIVO: 'bg-slate-100 text-slate-700 border-slate-300',
};

const BANCOS_SUGERIDOS = ['BCP', 'BBVA', 'INTERBANK', 'SCOTIABANK', 'BANCO DE LA NACION', 'BANBIF', 'CAJA HUANCAYO'];

const normalizarFormaPagoUI = (fp?: string | null, estado?: string, tieneBeneficiariosBanco?: boolean): string | null => {
  const limpio = (fp || '')
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (limpio.includes('CHEQUE')) return 'CHEQUE';
  if (limpio.includes('DEPOSITO')) return 'DEPOSITO';
  if (limpio.includes('TRANSFERENCIA')) return 'TRANSFERENCIA';
  if (limpio.includes('EFECTIVO')) return 'EFECTIVO';
  if (limpio) return limpio;
  if (estado === 'PAGADA' || tieneBeneficiariosBanco) return 'DEPOSITO';
  return null;
};

const obtenerBancosExp = (exp: Expediente): string[] => {
  const set = new Set<string>();
  if (Array.isArray(exp.bancos)) {
    exp.bancos.forEach((b) => { if (b && b.trim()) set.add(b.trim().toUpperCase()); });
  }
  if (exp.banco && exp.banco.trim()) {
    exp.banco.split(',').forEach((b) => { if (b.trim()) set.add(b.trim().toUpperCase()); });
  }
  if (Array.isArray(exp.beneficiarios)) {
    exp.beneficiarios.forEach((b) => {
      if (b.banco && b.banco.trim()) set.add(b.banco.trim().toUpperCase());
    });
  }
  return Array.from(set);
};

const obtenerMontoDadoExp = (exp: Expediente): number => {
  if (exp.montoEntregado != null && Number(exp.montoEntregado) > 0) return Number(exp.montoEntregado);
  if (exp.montoTotalAsignado != null && Number(exp.montoTotalAsignado) > 0) return Number(exp.montoTotalAsignado);
  if (Array.isArray(exp.beneficiarios) && exp.beneficiarios.length > 0) {
    const sum = exp.beneficiarios.reduce((acc, b) => acc + (Number(b.monto) || 0), 0);
    if (sum > 0) return Math.round(sum * 100) / 100;
  }
  return Number(exp.montoFinal ?? exp.monto) || 0;
};

const obtenerFechaDepositoExp = (exp: Expediente): string | null => {
  if (Array.isArray(exp.beneficiarios) && exp.beneficiarios.length > 0) {
    const depFecha = exp.beneficiarios.find((b) => b.fechaPago)?.fechaPago;
    if (depFecha) return depFecha;
  }
  return exp.fechaPago || null;
};

const fmtFecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const ICONS: Record<string, ReactNode> = {
  reloj: (
    <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  persona: (
    <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  ),
  alerta: (
    <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
  ),
  documento: (
    <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  dinero: (
    <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  banco: (
    <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
  ),
};

const TH_CLS = 'px-4 py-3 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider';

export default function ExpedientesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'historial' | 'todos' | 'reporte' | 'duplicados'>('historial');
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [eliminarTarget, setEliminarTarget] = useState<Expediente | null>(null);

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
  const [saldoFiltro, setSaldoFiltro] = useState('');
  const [formaPagoFiltro, setFormaPagoFiltro] = useState('');
  const [bancoFiltro, setBancoFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [regularizarTarget, setRegularizarTarget] = useState<Expediente | null>(null);
  const [editarExpId, setEditarExpId] = useState<string | null>(null);

  const [tipos, setTipos] = useState<TipoBeneficioOpt[]>([]);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const user = getCurrentUser();
    setPuedeCrear(!!user && user.rol !== 'AUDITOR');
    setEsAdmin(user?.rol === 'ADMINISTRADOR');
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
      if (estadoFiltro) params.estado = estadoFiltro;
      if (search) params.search = search;
      if (tipoFiltro) params.tipoBeneficioId = tipoFiltro;
      if (docsFiltro) params.documentacionCompleta = docsFiltro;
      if (saldoFiltro) params.conSaldoPendiente = saldoFiltro;
      if (formaPagoFiltro) params.formaPago = formaPagoFiltro;
      if (bancoFiltro) params.banco = bancoFiltro;
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;

      const { data } = await api.get('/fam-beneficios', { params });
      setExpedientes(Array.isArray(data?.data) ? data.data : []);
      setTotal(data?.meta?.total || 0);
    } catch {
      setExpedientes([]);
      setError('Error al cargar los expedientes. Verifique su sesión.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, tab, search, tipoFiltro, estadoFiltro, docsFiltro, saldoFiltro, formaPagoFiltro, bancoFiltro, fechaDesde, fechaHasta]);

  useEffect(() => { fetchExpedientes(); }, [fetchExpedientes]);
  useEffect(() => { setPage(1); setExpandidos(new Set()); }, [tab, search, tipoFiltro, estadoFiltro, docsFiltro, saldoFiltro, formaPagoFiltro, bancoFiltro, fechaDesde, fechaHasta, limit]);

  // Debounce para búsqueda reactiva al tipear en el buscador
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
          totalMontoDado: 0,
          totalRecibido: 0,
          totalPagados: 0,
          ultimoEstado: exp.estado,
          ultimaFecha: exp.fechaSolicitud || '',
          ultimaFechaPago: null,
          docsIncompletos: false,
          conteoEstados: {},
          beneficiariosUnicos: [],
          formasPago: [],
          bancos: [],
        });
      }
      const g = map.get(key)!;
      g.expedientes.push(exp);
      const montoDado = obtenerMontoDadoExp(exp);
      g.totalMonto += Number(exp.monto) || 0;
      g.totalMontoFinal += Number(exp.montoFinal ?? exp.monto) || 0;
      g.totalMontoDado += montoDado;
      g.conteoEstados[exp.estado] = (g.conteoEstados[exp.estado] || 0) + 1;
      if (!exp.documentacionCompleta) g.docsIncompletos = true;
      const fechaDeposito = obtenerFechaDepositoExp(exp);
      if (exp.estado === 'PAGADA') {
        g.totalPagados += 1;
        g.totalRecibido += montoDado;
        if (fechaDeposito && (!g.ultimaFechaPago || fechaDeposito > g.ultimaFechaPago)) {
          g.ultimaFechaPago = fechaDeposito;
        }
      } else if (fechaDeposito && (!g.ultimaFechaPago || fechaDeposito > g.ultimaFechaPago)) {
        g.ultimaFechaPago = fechaDeposito;
      }
      const bancosExp = obtenerBancosExp(exp);
      for (const bco of bancosExp) {
        if (!g.bancos.includes(bco)) g.bancos.push(bco);
      }
      const fp = normalizarFormaPagoUI(exp.formaPago, exp.estado, bancosExp.length > 0);
      if (fp && !g.formasPago.includes(fp)) {
        g.formasPago.push(fp);
      }
      if (Array.isArray(exp.beneficiarios) && exp.beneficiarios.length > 0) {
        for (const b of exp.beneficiarios) {
          if (b.nombre && !g.beneficiariosUnicos.some((u) => (u.dni && u.dni === b.dni) || u.nombre === b.nombre)) {
            g.beneficiariosUnicos.push({ nombre: b.nombre, dni: b.dni || '' });
          }
        }
      } else {
        const recNombre = exp.solicitanteNombre || (exp.estado === 'PAGADA' ? exp.NOMBRE_COLEGIADO : '');
        if (recNombre) {
          const recDni = exp.solicitanteDni || exp.DNI || '';
          const clave = recDni || recNombre;
          if (!g.beneficiariosUnicos.some((b) => (b.dni || b.nombre) === clave)) {
            g.beneficiariosUnicos.push({ nombre: recNombre, dni: recDni });
          }
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

  const resumenFinanciero = useMemo(() => {
    const mapaFp = new Map<string, { formaPago: string; count: number; monto: number }>();
    const mapaBanco = new Map<string, { banco: string; count: number; monto: number }>();
    let montoPaginaDado = 0;

    for (const exp of expedientes) {
      const mDado = obtenerMontoDadoExp(exp);
      montoPaginaDado += mDado;
      const bancosExp = obtenerBancosExp(exp);
      const fp = normalizarFormaPagoUI(exp.formaPago, exp.estado, bancosExp.length > 0);
      if (fp) {
        const cur = mapaFp.get(fp) || { formaPago: fp, count: 0, monto: 0 };
        cur.count += 1;
        cur.monto = Math.round((cur.monto + mDado) * 100) / 100;
        mapaFp.set(fp, cur);
      }
      if (Array.isArray(exp.beneficiarios) && exp.beneficiarios.some((b) => b.banco && b.banco.trim())) {
        const vistos = new Set<string>();
        for (const b of exp.beneficiarios) {
          const bco = (b.banco || exp.banco || '').trim().toUpperCase();
          if (!bco) continue;
          const curB = mapaBanco.get(bco) || { banco: bco, count: 0, monto: 0 };
          if (!vistos.has(bco)) {
            curB.count += 1;
            vistos.add(bco);
          }
          curB.monto = Math.round((curB.monto + (Number(b.monto) || 0)) * 100) / 100;
          mapaBanco.set(bco, curB);
        }
      } else {
        for (const bco of bancosExp) {
          const curB = mapaBanco.get(bco) || { banco: bco, count: 0, monto: 0 };
          curB.count += 1;
          curB.monto = Math.round((curB.monto + mDado) * 100) / 100;
          mapaBanco.set(bco, curB);
        }
      }
    }

    const porFormaPago: { formaPago: string; count: number; monto: number }[] =
      Array.isArray(dashboard?.porFormaPago) && dashboard.porFormaPago.length > 0
        ? dashboard.porFormaPago
        : Array.from(mapaFp.values()).sort((a, b) => b.monto - a.monto);

    const porBanco: { banco: string; count: number; monto: number }[] =
      Array.isArray(dashboard?.porBanco) && dashboard.porBanco.length > 0
        ? dashboard.porBanco
        : Array.from(mapaBanco.values()).sort((a, b) => b.monto - a.monto);

    const opcionesBancos = Array.from(
      new Set([
        ...porBanco.map((b) => b.banco),
        ...Array.from(mapaBanco.keys()),
        ...BANCOS_SUGERIDOS,
      ]),
    );

    const montoTotalEntregado =
      dashboard?.montoTotalEntregado != null && Number(dashboard.montoTotalEntregado) > 0
        ? Number(dashboard.montoTotalEntregado)
        : Math.round(montoPaginaDado * 100) / 100;

    return {
      montoTotalEntregado,
      montoPaginaDado: Math.round(montoPaginaDado * 100) / 100,
      porFormaPago,
      porBanco,
      opcionesBancos,
    };
  }, [dashboard, expedientes]);

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
    if (exp.beneficiarios && exp.beneficiarios.length > 0) {
      if (exp.beneficiarios.length === 1) return exp.beneficiarios[0].nombre;
      return `${exp.beneficiarios.length} beneficiarios`;
    }
    if (exp.estado !== 'PAGADA') return null;
    return exp.solicitanteNombre || exp.NOMBRE_COLEGIADO || null;
  };

  const handleExportar = async () => {
    try {
      const all: Expediente[] = [];
      let totalPagesExport = 1;
      for (let p = 1; p <= totalPagesExport && p <= 40; p++) {
        const params: Record<string, string | number> = { page: p, limit: 100, ordenarPor: 'ingreso' };
        if (estadoFiltro) params.estado = estadoFiltro;
        if (search) params.search = search;
        if (tipoFiltro) params.tipoBeneficioId = tipoFiltro;
        if (docsFiltro) params.documentacionCompleta = docsFiltro;
        if (saldoFiltro) params.conSaldoPendiente = saldoFiltro;
        if (formaPagoFiltro) params.formaPago = formaPagoFiltro;
        if (bancoFiltro) params.banco = bancoFiltro;
        if (fechaDesde) params.fechaDesde = fechaDesde;
        if (fechaHasta) params.fechaHasta = fechaHasta;
        const { data } = await api.get('/fam-beneficios', { params });
        all.push(...(data?.data || []));
        totalPagesExport = data?.meta?.totalPages || 1;
        if (!data?.meta || data.meta.page >= data.meta.totalPages) break;
      }

      if (!all.length) { alert('No hay expedientes para exportar con los filtros seleccionados.'); return; }

      // Hoja 1: Entregas por Beneficiario (detalle por cada persona y el monto exacto asignado/entregado)
      const filasDetalle: any[] = [];
      for (const r of all) {
        const bancosR = obtenerBancosExp(r);
        const fpR = normalizarFormaPagoUI(r.formaPago, r.estado, bancosR.length > 0);
        const tipoPagoLabel = fpR ? (FORMA_PAGO_LABELS[fpR] || fpR) : 'Por definir';
        const bens = Array.isArray(r.beneficiarios) && r.beneficiarios.length > 0
          ? r.beneficiarios
          : [{
              nombre: r.solicitanteNombre || r.NOMBRE_COLEGIADO || 'Sin registro',
              dni: r.solicitanteDni || r.DNI || '',
              parentesco: r.solicitanteDni && r.solicitanteDni === r.DNI ? 'Colegiado / Titular' : 'Solicitante',
              porcentaje: 100,
              monto: obtenerMontoDadoExp(r),
              banco: r.banco || '',
              numeroCuenta: '',
              cci: '',
              fechaPago: r.fechaPago || null,
              estado: r.estado,
            }];

        for (const b of bens) {
          filasDetalle.push({
            'N.° Expediente': r.expedienteNumero || 'S/N',
            'F. Ingreso / Registro': r.createdAt ? new Date(r.createdAt).toLocaleString('es-PE') : '',
            'F. Recepción': r.fechaSolicitud ? new Date(r.fechaSolicitud).toISOString().slice(0, 10) : '',
            'CIP Colegiado': r.NUM_COLEGIATURA || '',
            'DNI Colegiado': r.DNI || '',
            'Colegiado': r.NOMBRE_COLEGIADO || '',
            'Tipo de Beneficio': r.tipoBeneficio?.nombre || '',
            'Beneficiario': b.nombre || '',
            'DNI Beneficiario': b.dni || '',
            'Parentesco': b.parentesco || '',
            'Con Carta Poder': (b as any).conCartaPoder || r.conCartaPoder ? 'SÍ' : 'NO',
            'Cobra con Poder (Apoderado)': (b as any).apoderadoNombre || r.apoderadoNombre || '',
            'DNI Apoderado': (b as any).apoderadoDni || r.apoderadoDni || '',
            'Motivo / Trazabilidad Poder': r.poderMotivo || '',
            '% Asignado': b.porcentaje ? `${Number(b.porcentaje)}%` : '100%',
            'Monto Dado / Entregado (S/)': Number((b.monto || 0).toFixed(2)),
            'Tipo de Pago': tipoPagoLabel,
            'Banco': b.banco || r.banco || bancosR.join(', ') || '',
            'N.° Cuenta / Cheque / CCI': [b.numeroCuenta, b.cci ? `CCI: ${b.cci}` : ''].filter(Boolean).join(' / ') || '',
            'F. Pago': b.fechaPago ? new Date(b.fechaPago).toISOString().slice(0, 10) : (r.fechaPago ? new Date(r.fechaPago).toISOString().slice(0, 10) : ''),
            'Estado Pago': b.estado || r.estado,
            'Monto Total Exp. (S/)': Number((r.montoFinal ?? r.monto).toFixed(2)),
            'Descuento COVID (S/)': Number(r.descuentoCovid || 0),
            'Documentación': r.documentacionCompleta ? 'COMPLETA' : 'INCOMPLETA',
          });
        }
      }

      // Hoja 2: Resumen por Expediente
      const filasResumen = all.map((r) => {
        const bancosR = obtenerBancosExp(r);
        const fpR = normalizarFormaPagoUI(r.formaPago, r.estado, bancosR.length > 0);
        const tipoPagoLabel = fpR ? (FORMA_PAGO_LABELS[fpR] || fpR) : 'Por definir';
        const desgloseBens = (r.beneficiarios || []).map((b) => `${b.nombre} (${b.porcentaje}% - S/ ${Number(b.monto || 0).toFixed(2)}${b.banco ? ` [${b.banco}]` : ''})`).join('; ');
        return {
          'N.° Expediente': r.expedienteNumero || 'S/N',
          'F. Ingreso / Registro': r.createdAt ? new Date(r.createdAt).toLocaleString('es-PE') : '',
          'F. Recepción': r.fechaSolicitud ? new Date(r.fechaSolicitud).toISOString().slice(0, 10) : '',
          'CIP': r.NUM_COLEGIATURA || '',
          'DNI': r.DNI || '',
          'Colegiado': r.NOMBRE_COLEGIADO || '',
          'Tipo Beneficio': r.tipoBeneficio?.nombre || '',
          'Monto Base S/': Number(r.monto),
          'Descuento COVID S/': Number(r.descuentoCovid || 0),
          'Monto Dado / Entregado S/': Number(obtenerMontoDadoExp(r).toFixed(2)),
          'Tipo de Pago': tipoPagoLabel,
          'Banco(s)': bancosR.join(', ') || r.banco || '',
          'N.° Beneficiarios': (r.beneficiarios && r.beneficiarios.length) || 1,
          'Beneficiarios y Montos Asignados': desgloseBens || [r.solicitanteNombre, r.solicitanteDni].filter(Boolean).join(' · ') || '',
          'Estado': r.estado,
          'Documentación': r.documentacionCompleta ? 'COMPLETA' : 'INCOMPLETA',
          'F. Pago': r.fechaPago ? new Date(r.fechaPago).toISOString().slice(0, 10) : '',
        };
      });

      const wb = XLSX.utils.book_new();
      const wsDetalle = XLSX.utils.json_to_sheet(filasDetalle);
      const wsResumen = XLSX.utils.json_to_sheet(filasResumen);

      wsDetalle['!cols'] = [
        { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 32 }, { wch: 22 }, { wch: 32 }, { wch: 14 }, { wch: 15 },
        { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
        { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      ];
      wsResumen['!cols'] = [
        { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
        { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 45 }, { wch: 14 },
        { wch: 16 }, { wch: 12 },
      ];

      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Entregas por Beneficiario');
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Expedientes');
      XLSX.writeFile(wb, `Expedientes_FAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('Error al generar el archivo Excel.');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const filtrosActivos = search || tipoFiltro || estadoFiltro || docsFiltro || saldoFiltro || formaPagoFiltro || bancoFiltro || fechaDesde || fechaHasta;
  const desde = total > 0 ? (page - 1) * limit + 1 : 0;
  const hasta = Math.min(page * limit, total);

  const TABS = [
    { key: 'historial' as const, label: 'Historial de Entregas', desc: 'Todo lo registrado' },
    { key: 'todos' as const, label: 'Todos los Expedientes', desc: 'Todos los estados' },
    { key: 'reporte' as const, label: 'Reporte de Entregas', desc: 'Quién recibió y cuánto' },
    { key: 'duplicados' as const, label: 'Duplicados', desc: 'Beneficios otorgados más de una vez' },
  ];

  const kpis = dashboard ? [
    { key: 'montodado', label: 'Monto Total Dado', value: fmtMonto(resumenFinanciero.montoTotalEntregado), sub: `${dashboard.pagadosCount || total || 0} entrega(s) registrada(s)`, icon: ICONS.dinero, tone: 'text-emerald-700 bg-emerald-50' },
    { key: 'pendientes', label: 'Mis Pendientes', value: dashboard.misTendientes || 0, sub: 'asignados a mi', icon: ICONS.reloj, tone: 'text-amber-600 bg-amber-50' },
    { key: 'vencer', label: 'Próximos a Vencer', value: dashboard.proximosAVencer || 0, sub: `${dashboard.vencidos || 0} vencido${(dashboard.vencidos || 0) === 1 ? '' : 's'}`, icon: ICONS.alerta, tone: (dashboard.vencidos || 0) > 0 ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50' },
    { key: 'saldopendiente', label: 'Saldo Pendiente', value: dashboard.conSaldoPendienteCount || 0, sub: `S/ ${(dashboard.saldoPendienteTotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })} faltante`, icon: ICONS.alerta, tone: (dashboard.conSaldoPendienteCount || 0) > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-50' },
    { key: 'total', label: 'Total Expedientes', value: total, sub: 'registrados', icon: ICONS.documento, tone: 'text-primary bg-primary/10' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-xl sm:text-2xl font-semibold text-text-main">Expedientes de Beneficio</h2>
          <p className="text-text-sec text-sm mt-0.5">Gestión, seguimiento y reporte de beneficios del FAM</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {kpis.map((card) => (
              <div key={card.key} className="bg-white border border-border-main rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">{card.label}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1 text-text-main truncate" title={String(card.value)}>{card.value}</p>
                    <p className="text-[11px] text-text-sec mt-0.5 truncate">{card.sub}</p>
                  </div>
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.tone}`}>
                    {card.icon}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de Montos Dados por Tipo de Pago (Depósito / Cheque) y Bancos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white border border-border-main rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    {ICONS.dinero}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-text-main uppercase tracking-wider">Monto Dado por Tipo de Pago</h3>
                    <p className="text-[11px] text-text-sec">Desglose en Depósito, Cheque, Transferencia y Efectivo</p>
                  </div>
                </div>
                {formaPagoFiltro && (
                  <button
                    type="button"
                    onClick={() => setFormaPagoFiltro('')}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Ver todos
                  </button>
                )}
              </div>
              {resumenFinanciero.porFormaPago.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {resumenFinanciero.porFormaPago.map((item) => {
                    const activo = formaPagoFiltro === item.formaPago;
                    const label = FORMA_PAGO_LABELS[item.formaPago] || item.formaPago;
                    return (
                      <button
                        key={item.formaPago}
                        type="button"
                        onClick={() => setFormaPagoFiltro(activo ? '' : item.formaPago)}
                        className={`text-left p-2.5 rounded-lg border transition-colors ${
                          activo
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border-main bg-slate-50/60 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded border ${FORMA_PAGO_BADGE[item.formaPago] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {label}
                          </span>
                          <span className="text-[10px] font-semibold text-text-sec">{item.count} exp.</span>
                        </div>
                        <p className="text-sm font-bold text-text-main mt-1.5 truncate" title={fmtMonto(item.monto)}>
                          {fmtMonto(item.monto)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-sec py-2">Sin entregas registradas por medio de pago aún.</p>
              )}
            </div>

            <div className="bg-white border border-border-main rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    {ICONS.banco}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-text-main uppercase tracking-wider">Monto Dado por Bancos</h3>
                    <p className="text-[11px] text-text-sec">Entidades bancarias de depósitos y cheques</p>
                  </div>
                </div>
                {bancoFiltro && (
                  <button
                    type="button"
                    onClick={() => setBancoFiltro('')}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Ver todos
                  </button>
                )}
              </div>
              {resumenFinanciero.porBanco.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-[86px] overflow-y-auto pr-1">
                  {resumenFinanciero.porBanco.map((item) => {
                    const activo = bancoFiltro.toUpperCase() === item.banco.toUpperCase();
                    return (
                      <button
                        key={item.banco}
                        type="button"
                        onClick={() => setBancoFiltro(activo ? '' : item.banco)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-colors ${
                          activo
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border-main bg-slate-50/60 hover:bg-slate-100/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-text-main">{item.banco}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-white border border-border-main rounded-full text-text-sec font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-emerald-700">{fmtMonto(item.monto)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-sec py-2">No se han especificado bancos en los expedientes listados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="-mx-3 sm:mx-0 px-3 sm:px-0 flex gap-5 border-b border-border-main overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2.5 px-1 text-left border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${tab === t.key ? 'border-primary' : 'border-transparent hover:border-gray-300'}`}>
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
          <div className="p-3 sm:p-4 border-b border-border-main bg-gray-50/50">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5">
              <div className="relative w-full sm:flex-1 sm:min-w-[220px] sm:max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar por CIP, DNI, nombre o banco..." value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                  className="w-full pl-10 pr-4 py-2 border border-border-main rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
              </div>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
                className="w-full sm:w-auto border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Todos los tipos</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <select value={formaPagoFiltro} onChange={(e) => setFormaPagoFiltro(e.target.value)}
                className="w-full sm:w-auto border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Tipo pago (Depósito / Cheque)</option>
                <option value="DEPOSITO">Depósito</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="EFECTIVO">Efectivo</option>
              </select>
              <select value={bancoFiltro} onChange={(e) => setBancoFiltro(e.target.value)}
                className="w-full sm:w-auto border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Todos los bancos</option>
                {resumenFinanciero.opcionesBancos.map((bco) => (
                  <option key={bco} value={bco}>{bco}</option>
                ))}
              </select>
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
                className="w-full sm:w-auto border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Todos los estados</option>
                {ESTADO_OPTIONS.map((e) => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
              </select>
              <select value={docsFiltro} onChange={(e) => setDocsFiltro(e.target.value)}
                className="w-full sm:w-auto border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Toda documentación</option>
                <option value="SI">Documentación completa</option>
                <option value="NO">Documentación incompleta</option>
              </select>
              <select value={saldoFiltro} onChange={(e) => setSaldoFiltro(e.target.value)}
                className="w-full sm:w-auto border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Todos los saldos</option>
                <option value="SI">Con saldo pendiente</option>
                <option value="NO">Sin saldo pendiente</option>
              </select>
              <div className="flex items-center gap-1.5">
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                  className="flex-1 sm:flex-none border border-border-main rounded-lg px-2.5 py-2 text-sm bg-white min-w-0" />
                <span className="text-xs text-text-sec">a</span>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                  className="flex-1 sm:flex-none border border-border-main rounded-lg px-2.5 py-2 text-sm bg-white min-w-0" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setSearch(searchInput); setPage(1); }}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                  Buscar
                </button>
                {filtrosActivos && (
                  <button onClick={() => { setSearchInput(''); setSearch(''); setTipoFiltro(''); setEstadoFiltro(''); setDocsFiltro(''); setSaldoFiltro(''); setFormaPagoFiltro(''); setBancoFiltro(''); setFechaDesde(''); setFechaHasta(''); }}
                    className="flex-1 sm:flex-none px-3 py-2 text-sm text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors">
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead>
                <tr className="bg-gray-50 border-b border-border-main">
                  <th className="w-8 px-3 py-3"></th>
                  <th className={TH_CLS}>Colegiado</th>
                  <th className={TH_CLS}>CIP / DNI</th>
                  <th className={TH_CLS}>Recibido por</th>
                  <th className={TH_CLS}>Monto Dado</th>
                  <th className={TH_CLS}>Tipo Pago / Banco</th>
                  <th className={TH_CLS}>Estado</th>
                  <th className={TH_CLS}>Docs</th>
                  <th className={TH_CLS}>F. Solicitud</th>
                  <th className={TH_CLS}>F. Pago</th>
                  <th className={`${TH_CLS} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-text-sec">
                      <svg
                        className="animate-spin w-5 h-5"
                        width="20"
                        height="20"
                        style={{ width: '20px', height: '20px', flexShrink: 0 }}
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cargando expedientes...
                    </div>
                  </td></tr>
                ) : grupos.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-16 text-center text-text-sec">
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
                      <td colSpan={11} className="px-4 py-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs text-text-sec">
                            {grupos.length} colegiado{grupos.length !== 1 ? 's' : ''} en esta página · {total.toLocaleString('es-PE')} expediente{total !== 1 ? 's' : ''} en total ·{' '}
                            <strong className="text-text-main">Monto dado en página: {fmtMonto(resumenFinanciero.montoPaginaDado)}</strong>
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
                      const expUnico = soloUno ? grupo.expedientes[0] : null;
                      const cuentasUnico = expUnico?.beneficiarios
                        ?.map((b) => [b.numeroCuenta, b.cci ? `CCI: ${b.cci}` : ''].filter(Boolean).join(' · '))
                        .filter(Boolean) || [];

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
                                  <p className="text-[10px] text-text-sec">
                                    {soloUno
                                      ? `${expUnico?.tipoBeneficio?.nombre || '1 expediente'}${expUnico?.expedienteNumero ? ` · Exp. ${expUnico.expedienteNumero}` : ''}`
                                      : `${grupo.expedientes.length} expedientes`}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-sm font-semibold text-primary">{grupo.NUM_COLEGIATURA}</span>
                              <span className="block text-[10px] text-text-sec">DNI: {grupo.DNI || '—'}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {recibe ? (
                                <div className="min-w-0 max-w-[175px]">
                                  <p className="text-xs font-medium text-text-main truncate" title={grupo.beneficiariosUnicos.length === 1 ? `${grupo.beneficiariosUnicos[0].nombre}${grupo.beneficiariosUnicos[0].dni ? ` · DNI ${grupo.beneficiariosUnicos[0].dni}` : ''}` : undefined}>
                                    {recibe}
                                  </p>
                                  {expUnico?.conCartaPoder && (
                                    <span
                                      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300 max-w-full truncate"
                                      title={`Otorgante: ${expUnico.poderOtorganteNombre || recibe} (${expUnico.poderOtorganteParentesco || 'Beneficiario'}) → Cobra con Carta Poder: ${expUnico.apoderadoNombre || 'Apoderado'}${expUnico.apoderadoDni ? ` (DNI ${expUnico.apoderadoDni})` : ''}`}
                                    >
                                      📋 Cobra: {expUnico.apoderadoNombre || 'Con Poder'}
                                    </span>
                                  )}
                                  {expUnico && expUnico.beneficiarios && expUnico.beneficiarios.length > 1 ? (
                                    <div className="mt-0.5 space-y-0.5">
                                      {expUnico.beneficiarios.map((b, bi) => (
                                        <p key={bi} className="text-[10px] text-text-sec truncate" title={`${b.nombre}: ${fmtMonto(b.monto)} (${b.porcentaje}%)`}>
                                          • {b.nombre}: <span className="font-semibold text-text-main">{fmtMonto(b.monto)}</span>
                                        </p>
                                      ))}
                                    </div>
                                  ) : grupo.totalPagados > 0 ? (
                                    <p className="text-[10px] text-emerald-600 font-medium">{grupo.totalPagados} pago{grupo.totalPagados !== 1 ? 's' : ''} realizado{grupo.totalPagados !== 1 ? 's' : ''}</p>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-xs text-text-sec">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div>
                                <span className="text-sm font-bold text-emerald-700" title="Monto total dado / entregado">
                                  {fmtMonto(grupo.totalMontoDado)}
                                </span>
                                {grupo.totalMonto !== grupo.totalMontoDado && (
                                  <span className="block text-[10px] text-text-sec">Base: {fmtMonto(grupo.totalMonto)}</span>
                                )}
                                {expUnico && expUnico.descuentoCovid != null && expUnico.descuentoCovid > 0 && (
                                  <span className="block text-[10px] text-amber-700 font-medium">Dto. COVID: -{fmtMonto(expUnico.descuentoCovid)}</span>
                                )}
                                {grupo.expedientes.some((e) => e.tieneSaldoPendiente) && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    Saldo pend.: S/ {grupo.expedientes.reduce((sum, e) => sum + (Number(e.saldoPendiente) || 0), 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="space-y-1 min-w-[130px]">
                                {grupo.formasPago.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {grupo.formasPago.map((fp) => (
                                      <span
                                        key={fp}
                                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded border ${FORMA_PAGO_BADGE[fp] || 'bg-slate-100 text-slate-700 border-slate-300'}`}
                                      >
                                        {FORMA_PAGO_LABELS[fp] || fp}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-text-sec">Por definir</span>
                                )}
                                {grupo.bancos.length > 0 ? (
                                  <p className="text-xs font-semibold text-text-main truncate max-w-[160px]" title={`Banco(s): ${grupo.bancos.join(', ')}`}>
                                    {grupo.bancos.join(', ')}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-text-sec">Sin banco reg.</p>
                                )}
                                {cuentasUnico.length > 0 && (
                                  <p className="text-[10px] text-text-sec truncate max-w-[160px]" title={cuentasUnico.join(' | ')}>
                                    Cta/Ref: {cuentasUnico[0]}
                                  </p>
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
                                  <>
                                  <button onClick={() => router.push(`/dashboard/fam/expedientes/${grupo.expedientes[0].id}`)}
                                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Ver detalle del expediente"
                                    aria-label="Ver detalle del expediente">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  </button>
                                  {grupo.expedientes[0].tieneSaldoPendiente && puedeCrear && (
                                    <button onClick={() => setRegularizarTarget(grupo.expedientes[0])}
                                      className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors" title="Regularizar saldo pendiente"
                                      aria-label="Regularizar saldo pendiente">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    </button>
                                  )}
                                  {esAdmin && (
                                    <button onClick={() => setEditarExpId(grupo.expedientes[0].id)}
                                      className="p-1.5 rounded-lg hover:bg-blue-50 text-[#3258CA] transition-colors" title="Editar expediente (Administrador)"
                                      aria-label="Editar expediente">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                  )}
                                  {esAdmin && (
                                    <button onClick={() => setEliminarTarget(grupo.expedientes[0])}
                                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Eliminar expediente"
                                      aria-label="Eliminar expediente">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  )}
                                  </>
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
                            const mDadoExp = obtenerMontoDadoExp(exp);
                            const bancosExp = obtenerBancosExp(exp);
                            const fpExp = normalizarFormaPagoUI(exp.formaPago, exp.estado, bancosExp.length > 0);
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
                                  {exp.beneficiarios && exp.beneficiarios.length > 1 ? (
                                    <div className="min-w-0 max-w-[180px] space-y-0.5">
                                      {exp.beneficiarios.map((b, bi) => (
                                        <p key={bi} className="text-[11px] text-text-main truncate" title={`${b.nombre} (${b.porcentaje}% · S/ ${b.monto.toFixed(2)})`}>
                                          <span className="font-medium">{b.nombre}</span> <span className="text-primary font-semibold">({b.porcentaje}% · {fmtMonto(b.monto)})</span>
                                        </p>
                                      ))}
                                    </div>
                                  ) : recibeExp ? (
                                    <div className="min-w-0 max-w-[165px]">
                                      <p className="text-xs font-medium text-text-main truncate" title={exp.solicitanteDni ? `${recibeExp} · DNI ${exp.solicitanteDni}` : recibeExp}>{recibeExp}</p>
                                      {exp.solicitanteDni && <p className="text-[10px] text-text-sec">DNI: {exp.solicitanteDni}</p>}
                                      {exp.conCartaPoder && (
                                        <span
                                          className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300 max-w-full truncate"
                                          title={`Otorgante: ${exp.poderOtorganteNombre || recibeExp} → Cobra con Carta Poder: ${exp.apoderadoNombre || 'Apoderado'}`}
                                        >
                                          📋 Cobra: {exp.apoderadoNombre || 'Carta Poder'}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-text-sec">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div>
                                    <span className="text-xs font-bold text-emerald-700">{fmtMonto(mDadoExp)}</span>
                                    {exp.monto !== mDadoExp && (
                                      <span className="block text-[10px] text-text-sec">Base: {fmtMonto(exp.monto)}</span>
                                    )}
                                    {exp.tieneSaldoPendiente && (
                                      <span className="block text-[10px] text-amber-700 font-semibold" title="Saldo pendiente normativo">
                                        Falta: S/ {Number(exp.saldoPendiente || 0).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="space-y-0.5">
                                    {fpExp ? (
                                      <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded border ${FORMA_PAGO_BADGE[fpExp] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                                        {FORMA_PAGO_LABELS[fpExp] || fpExp}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-text-sec">Por definir</span>
                                    )}
                                    {bancosExp.length > 0 && (
                                      <p className="text-[11px] font-semibold text-text-main truncate max-w-[140px]" title={bancosExp.join(', ')}>
                                        {bancosExp.join(', ')}
                                      </p>
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
                                  {obtenerFechaDepositoExp(exp) ? (
                                    <span className="font-medium text-emerald-700">{fmtFecha(obtenerFechaDepositoExp(exp))}</span>
                                  ) : (
                                    <span className="text-text-sec">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-center gap-1">
                                    <button onClick={() => router.push(`/dashboard/fam/expedientes/${exp.id}`)}
                                      className="p-1 rounded hover:bg-primary/10 text-primary transition-colors" title="Ver detalle del expediente"
                                      aria-label="Ver detalle del expediente">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </button>
                                    {exp.tieneSaldoPendiente && puedeCrear && (
                                      <button onClick={() => setRegularizarTarget(exp)}
                                        className="p-1 rounded hover:bg-amber-100 text-amber-700 transition-colors" title="Regularizar saldo pendiente"
                                        aria-label="Regularizar saldo pendiente">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                      </button>
                                    )}
                                    {esAdmin && (
                                      <button onClick={() => setEditarExpId(exp.id)}
                                        className="p-1 rounded hover:bg-blue-50 text-[#3258CA] transition-colors" title="Editar expediente (Administrador)"
                                        aria-label="Editar expediente">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      </button>
                                    )}
                                    {esAdmin && (
                                      <button onClick={() => setEliminarTarget(exp)}
                                        className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors" title="Eliminar expediente"
                                        aria-label="Eliminar expediente">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    )}
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
          <div className="px-3 sm:px-4 py-3 border-t border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/80">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs sm:text-sm text-text-sec">{total > 0 ? `Mostrando ${desde.toLocaleString('es-PE')} a ${hasta.toLocaleString('es-PE')} de ${total.toLocaleString('es-PE')}` : 'Sin registros'}</p>
              <span className="text-xs text-text-sec hidden sm:inline">·</span>
              <span className="text-xs text-text-sec hidden sm:inline">{grupos.length} colegiado{grupos.length !== 1 ? 's' : ''} en esta página</span>
              <span className="text-xs text-text-sec ml-1">Mostrar</span>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                className="border border-border-main rounded px-2 py-1 text-xs bg-white">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
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

      {eliminarTarget && (
        <EliminarExpedienteModal
          isOpen={Boolean(eliminarTarget)}
          onClose={() => setEliminarTarget(null)}
          expedienteId={eliminarTarget.id}
          expedienteNumero={eliminarTarget.expedienteNumero}
          estado={eliminarTarget.estado}
          onDeleted={() => {
            setEliminarTarget(null);
            fetchExpedientes();
          }}
        />
      )}

      {editarExpId && (
        <EditarExpedienteModal
          expedienteId={editarExpId}
          onClose={() => setEditarExpId(null)}
          onSaved={() => {
            setEditarExpId(null);
            fetchExpedientes();
          }}
        />
      )}

      {regularizarTarget && (
        <ModalRegularizarSaldo
          isOpen={Boolean(regularizarTarget)}
          onClose={() => setRegularizarTarget(null)}
          onSuccess={() => {
            setRegularizarTarget(null);
            fetchExpedientes();
            api.get('/expediente-sla/dashboard').then(({ data }) => setDashboard(data)).catch(() => {});
          }}
          expedienteId={regularizarTarget.id}
          expedienteNumero={regularizarTarget.expedienteNumero}
          colegiadoNombre={regularizarTarget.NOMBRE_COLEGIADO}
          montoTotalAsignado={Number(regularizarTarget.montoTotalAsignado ?? regularizarTarget.monto)}
          saldoPendiente={Number(regularizarTarget.saldoPendiente || 0)}
          montoMinimoNormativo={3000}
        />
      )}
    </div>
  );
}
