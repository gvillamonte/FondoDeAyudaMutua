'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

interface ExpedientePago {
  id: string;
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  tipoBeneficio?: { id: string; codigo: string; nombre: string };
  monto: number;
  estado: string;
  fechaSolicitud: string;
  fechaPago: string | null;
  documentacionCompleta: boolean;
  solicitanteNombre: string | null;
  solicitanteDni: string | null;
  expedienteNumero: string | null;
  descuentoCovid: number | null;
  montoFinal: number | null;
  createdAt?: string;
  banco?: string | null;
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
  }>;
}

interface TipoBeneficioOpt {
  id: number;
  nombre: string;
}

interface BeneficiarioReporte {
  clave: string;
  nombre: string;
  dni: string;
  colegiados: string[];
  totalEntregas: number;
  montoRecibido: number;
  ultimaFechaPago: string | null;
}

const fmtFecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const MAX_PAGINAS = 40;

export default function ReporteEntregas({ tipos }: { tipos: TipoBeneficioOpt[] }) {
  const router = useRouter();

  const [rows, setRows] = useState<ExpedientePago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [fechaPagoDesde, setFechaPagoDesde] = useState('');
  const [fechaPagoHasta, setFechaPagoHasta] = useState('');

  const [vista, setVista] = useState<'beneficiarios' | 'detalle'>('beneficiarios');
  const [orden, setOrden] = useState<{ campo: 'monto' | 'fecha' | 'nombre'; dir: 'asc' | 'desc' }>({
    campo: 'monto',
    dir: 'desc',
  });

  const fetchReporte = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all: ExpedientePago[] = [];
      let pagina = 1;
      let totalPages = 1;
      do {
        const params: Record<string, string | number> = { page: pagina, limit: 100, estado: 'PAGADA', ordenarPor: 'ingreso' };
        if (search) params.search = search;
        if (tipoFiltro) params.tipoBeneficioId = tipoFiltro;
        const { data } = await api.get('/fam-beneficios', { params });
        all.push(...(Array.isArray(data?.data) ? data.data : []));
        totalPages = data?.meta?.totalPages || 1;
        pagina++;
      } while (pagina <= totalPages && pagina <= MAX_PAGINAS);
      setRows(all);
    } catch {
      setRows([]);
      setError('Error al cargar el reporte de entregas. Verifique su sesión.');
    } finally {
      setLoading(false);
    }
  }, [search, tipoFiltro]);

  useEffect(() => { fetchReporte(); }, [fetchReporte]);

  const hayRango = !!(fechaPagoDesde || fechaPagoHasta);
  const filtradas = rows.filter((r) => {
    if (!hayRango) return true;
    if (!r.fechaPago) return false;
    const f = r.fechaPago.slice(0, 10);
    if (fechaPagoDesde && f < fechaPagoDesde) return false;
    if (fechaPagoHasta && f > fechaPagoHasta) return false;
    return true;
  });

  const totalEntregado = filtradas.reduce((s, r) => s + (Number(r.montoFinal ?? r.monto) || 0), 0);

  const beneficiarios: BeneficiarioReporte[] = (() => {
    const map = new Map<string, BeneficiarioReporte>();
    for (const r of filtradas) {
      const bens = Array.isArray(r.beneficiarios) && r.beneficiarios.length > 0
        ? r.beneficiarios
        : [{
            nombre: r.solicitanteNombre || r.NOMBRE_COLEGIADO || 'Sin registro',
            dni: r.solicitanteDni || r.DNI || '',
            parentesco: '',
            porcentaje: 100,
            monto: Number(r.montoFinal ?? r.monto) || 0,
            banco: r.banco || '',
            numeroCuenta: '',
            cci: '',
            fechaPago: r.fechaPago,
            estado: r.estado,
          }];

      for (const b of bens) {
        const nombre = b.nombre || r.solicitanteNombre || r.NOMBRE_COLEGIADO || 'Sin registro';
        const dni = b.dni || r.solicitanteDni || r.DNI || '';
        const clave = dni || nombre;
        const reg = map.get(clave) || {
          clave, nombre, dni, colegiados: [], totalEntregas: 0, montoRecibido: 0, ultimaFechaPago: null,
        };
        if (r.NUM_COLEGIATURA && !reg.colegiados.includes(r.NUM_COLEGIATURA)) reg.colegiados.push(r.NUM_COLEGIATURA);
        reg.totalEntregas += 1;
        reg.montoRecibido += Number(b.monto) || 0;
        const fPago = b.fechaPago || r.fechaPago;
        if (fPago && (!reg.ultimaFechaPago || fPago > reg.ultimaFechaPago)) reg.ultimaFechaPago = fPago;
        map.set(clave, reg);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const dir = orden.dir === 'asc' ? 1 : -1;
      if (orden.campo === 'monto') return (a.montoRecibido - b.montoRecibido) * dir;
      if (orden.campo === 'fecha') return (((a.ultimaFechaPago || '') > (b.ultimaFechaPago || '') ? 1 : -1)) * dir;
      return a.nombre.localeCompare(b.nombre, 'es') * dir;
    });
    return arr;
  })();

  const detalleOrdenado = [...filtradas].sort((a, b) => {
    const fa = a.fechaPago || '';
    const fb = b.fechaPago || '';
    return orden.dir === 'asc' ? fa.localeCompare(fb) : fb.localeCompare(fa);
  });

  const fechas = filtradas.map((r) => r.fechaPago).filter(Boolean).sort() as string[];
  const periodo = fechas.length
    ? `${fmtFecha(fechas[0])} — ${fmtFecha(fechas[fechas.length - 1])}`
    : 'Sin pagos en el rango';

  const filtrosActivos = !!(search || tipoFiltro || fechaPagoDesde || fechaPagoHasta);

  const toggleOrden = (campo: 'monto' | 'fecha' | 'nombre') => {
    setOrden((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' }));
  };

  const handleExportar = () => {
    try {
      if (!filtradas.length) {
        alert('No hay entregas para exportar con los filtros seleccionados.');
        return;
      }

      // Hoja 1: Entregas por Beneficiario (detalle por cada beneficiario y su monto exacto entregado)
      const filasDetalle: any[] = [];
      for (const r of filtradas) {
        const bens = Array.isArray(r.beneficiarios) && r.beneficiarios.length > 0
          ? r.beneficiarios
          : [{
              nombre: r.solicitanteNombre || r.NOMBRE_COLEGIADO || 'Sin registro',
              dni: r.solicitanteDni || r.DNI || '',
              parentesco: r.solicitanteDni && r.solicitanteDni === r.DNI ? 'Colegiado / Titular' : 'Solicitante',
              porcentaje: 100,
              monto: Number(r.montoFinal ?? r.monto) || 0,
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
            'CIP Colegiado': r.NUM_COLEGIATURA || '',
            'DNI Colegiado': r.DNI || '',
            'Colegiado': r.NOMBRE_COLEGIADO || '',
            'Tipo Beneficio': r.tipoBeneficio?.nombre || '',
            'Beneficiario': b.nombre || '',
            'DNI Beneficiario': b.dni || '',
            'Parentesco': b.parentesco || '',
            '% Asignado': b.porcentaje ? `${Number(b.porcentaje)}%` : '100%',
            'Monto Entregado S/': Number((b.monto || 0).toFixed(2)),
            'Banco': b.banco || r.banco || '',
            'N.° Cuenta / CCI': [b.numeroCuenta, b.cci ? `CCI: ${b.cci}` : ''].filter(Boolean).join(' / ') || '',
            'F. Pago': b.fechaPago ? b.fechaPago.slice(0, 10) : (r.fechaPago ? r.fechaPago.slice(0, 10) : ''),
            'Estado': b.estado || r.estado,
            'Monto Total Exp. S/': Number((r.montoFinal ?? r.monto).toFixed(2)),
            'Descuento COVID S/': Number(r.descuentoCovid || 0),
          });
        }
      }

      // Hoja 2: Consolidado por Beneficiario
      const wsResumen = XLSX.utils.json_to_sheet(beneficiarios.map((b) => ({
        'Beneficiario': b.nombre,
        'DNI': b.dni,
        'Colegiados (CIP)': b.colegiados.join(', '),
        'N.° Entregas': b.totalEntregas,
        'Monto Total Recibido S/': Number(b.montoRecibido.toFixed(2)),
        'Última F. Pago': b.ultimaFechaPago ? b.ultimaFechaPago.slice(0, 10) : '',
      })));

      // Hoja 3: Resumen por Expediente
      const wsExpedientes = XLSX.utils.json_to_sheet(filtradas.map((r) => {
        const desgloseBens = (r.beneficiarios || []).map((b) => `${b.nombre} (${b.porcentaje}% - S/ ${Number(b.monto || 0).toFixed(2)})`).join('; ');
        return {
          'N.° Expediente': r.expedienteNumero || 'S/N',
          'F. Ingreso / Registro': r.createdAt ? new Date(r.createdAt).toLocaleString('es-PE') : '',
          'CIP': r.NUM_COLEGIATURA,
          'Colegiado': r.NOMBRE_COLEGIADO,
          'Tipo Beneficio': r.tipoBeneficio?.nombre || '',
          'Monto S/': Number(r.monto),
          'Descuento COVID S/': Number(r.descuentoCovid || 0),
          'Monto Recibido S/': Number((r.montoFinal ?? r.monto).toFixed(2)),
          'Beneficiarios y Montos Asignados': desgloseBens || [r.solicitanteNombre, r.solicitanteDni].filter(Boolean).join(' · ') || '',
          'F. Pago': r.fechaPago ? r.fechaPago.slice(0, 10) : '',
          'Estado': r.estado,
        };
      }));

      const wb = XLSX.utils.book_new();
      const wsDetalle = XLSX.utils.json_to_sheet(filasDetalle);

      wsDetalle['!cols'] = [
        { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 32 },
        { wch: 22 }, { wch: 32 }, { wch: 14 }, { wch: 15 }, { wch: 12 },
        { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
        { wch: 18 }, { wch: 16 },
      ];
      wsResumen['!cols'] = [
        { wch: 32 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
      ];
      wsExpedientes['!cols'] = [
        { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 32 }, { wch: 22 },
        { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 45 }, { wch: 12 }, { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Entregas por Beneficiario');
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Por Beneficiario (Consolidado)');
      XLSX.utils.book_append_sheet(wb, wsExpedientes, 'Resumen Expedientes');
      XLSX.writeFile(wb, `Reporte_Entregas_FAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('Error al generar el archivo Excel.');
    }
  };

  const thCls = 'px-4 py-3 text-left text-[10px] font-semibold text-text-sec uppercase tracking-wider';

  return (
    <div className="bg-white border border-border-main rounded-xl overflow-hidden shadow-sm">
      {/* Filtros */}
      <div className="p-4 border-b border-border-main bg-gray-50/50">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar por CIP, DNI o nombre..." value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
              className="w-full pl-10 pr-4 py-2 border border-border-main rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
          </div>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
            className="border border-border-main rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-sec">F. pago</span>
            <input type="date" value={fechaPagoDesde} onChange={(e) => setFechaPagoDesde(e.target.value)}
              className="border border-border-main rounded-lg px-2.5 py-2 text-sm bg-white" />
            <span className="text-xs text-text-sec">a</span>
            <input type="date" value={fechaPagoHasta} onChange={(e) => setFechaPagoHasta(e.target.value)}
              className="border border-border-main rounded-lg px-2.5 py-2 text-sm bg-white" />
          </div>
          <button onClick={() => setSearch(searchInput)}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            Buscar
          </button>
          {filtrosActivos && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setTipoFiltro(''); setFechaPagoDesde(''); setFechaPagoHasta(''); }}
              className="px-3 py-2 text-sm text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors">
              Limpiar
            </button>
          )}
          <button onClick={handleExportar}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Excel
          </button>
        </div>
      </div>

      {error && <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Cards consolidado */}
      <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-border-main">
        {[
          { label: 'Total entregado', value: fmtMonto(totalEntregado), sub: periodo, strong: true },
          { label: 'Entregas realizadas', value: filtradas.length, sub: 'expedientes pagados' },
          { label: 'Personas que recibieron', value: beneficiarios.length, sub: 'beneficiarios distintos' },
          { label: 'Promedio por entrega', value: fmtMonto(filtradas.length ? totalEntregado / filtradas.length : 0), sub: 'monto neto promedio' },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-border-main rounded-lg p-4">
            <p className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">{c.label}</p>
            <p className={`mt-1 ${c.strong ? 'text-xl font-bold text-primary' : 'text-xl font-bold text-text-main'}`}>{c.value}</p>
            <p className="text-[11px] text-text-sec mt-0.5 truncate" title={c.sub}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="px-4 pt-3 flex gap-4 border-b border-border-main">
        {([
          { key: 'beneficiarios' as const, label: 'Por beneficiario' },
          { key: 'detalle' as const, label: 'Detalle de entregas' },
        ]).map((t) => (
          <button key={t.key} onClick={() => setVista(t.key)}
            className={`pb-2.5 px-1 text-sm font-medium border-b-2 transition-colors ${vista === t.key ? 'border-primary text-primary' : 'border-transparent text-text-sec hover:text-text-main'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tablas */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-text-sec">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Cargando reporte de entregas...
            </div>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="px-4 py-16 text-center text-text-sec">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-sm font-medium">No hay entregas registradas</p>
              <p className="text-xs text-text-sec mt-1">Ajuste los filtros o verifique que existan expedientes con estado PAGADA</p>
            </div>
          </div>
        ) : vista === 'beneficiarios' ? (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-border-main">
                <th className={thCls}>
                  <button onClick={() => toggleOrden('nombre')} className="uppercase hover:text-text-main transition-colors inline-flex items-center gap-1">
                    Beneficiario
                    {orden.campo === 'nombre' && <span className="text-primary">{orden.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className={thCls}>Colegiado (CIP)</th>
                <th className={`${thCls} text-center`}>Entregas</th>
                <th className={thCls}>
                  <button onClick={() => toggleOrden('monto')} className="uppercase hover:text-text-main transition-colors inline-flex items-center gap-1">
                    Monto recibido
                    {orden.campo === 'monto' && <span className="text-primary">{orden.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className={thCls}>
                  <button onClick={() => toggleOrden('fecha')} className="uppercase hover:text-text-main transition-colors inline-flex items-center gap-1">
                    Última F. Pago
                    {orden.campo === 'fecha' && <span className="text-primary">{orden.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {beneficiarios.map((b) => (
                <tr key={b.clave} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{b.nombre?.charAt(0) || '?'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-main truncate" title={b.nombre}>{b.nombre}</p>
                        <p className="text-[10px] text-text-sec">DNI: {b.dni || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {b.colegiados.map((c) => (
                        <span key={c} className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-bold rounded-full bg-primary/10 text-primary">
                      {b.totalEntregas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-text-main">{fmtMonto(b.montoRecibido)}</td>
                  <td className="px-4 py-3 text-xs text-text-sec whitespace-nowrap">{fmtFecha(b.ultimaFechaPago)}</td>
                </tr>
              ))}
              <tr className="bg-blue-50/40 font-semibold">
                <td className="px-4 py-3 text-sm text-text-main" colSpan={2}>
                  Total consolidado · {beneficiarios.length} beneficiario{beneficiarios.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-center text-sm text-primary font-bold">{filtradas.length}</td>
                <td className="px-4 py-3 text-sm font-bold text-primary">{fmtMonto(totalEntregado)}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-border-main">
                <th className={thCls}>N.° Expediente</th>
                <th className={thCls}>Colegiado</th>
                <th className={thCls}>Tipo de beneficio</th>
                <th className={thCls}>Beneficiario</th>
                <th className={thCls}>Monto recibido</th>
                <th className={thCls}>F. Pago</th>
                <th className={`${thCls} text-center`}>Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {detalleOrdenado.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-text-main">{r.expedienteNumero || 'S/N'}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-main truncate max-w-[180px]" title={r.NOMBRE_COLEGIADO}>{r.NOMBRE_COLEGIADO}</p>
                    <p className="text-[10px] text-text-sec font-semibold">CIP {r.NUM_COLEGIATURA || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-sec">{r.tipoBeneficio?.nombre || '—'}</td>
                  <td className="px-4 py-3">
                    {r.beneficiarios && r.beneficiarios.length > 1 ? (
                      <div className="space-y-1">
                        {r.beneficiarios.map((b, bi) => (
                          <div key={bi} className="text-xs">
                            <span className="font-semibold text-text-main">{b.nombre}</span>
                            <span className="text-[10px] text-text-sec ml-1">({b.parentesco || 'Ben.'} · DNI: {b.dni || '—'})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-text-main truncate max-w-[180px]" title={r.beneficiarios?.[0]?.nombre || r.solicitanteNombre || r.NOMBRE_COLEGIADO}>
                          {r.beneficiarios?.[0]?.nombre || r.solicitanteNombre || r.NOMBRE_COLEGIADO || '—'}
                        </p>
                        <p className="text-[10px] text-text-sec">
                          {r.beneficiarios?.[0]?.parentesco ? `${r.beneficiarios[0].parentesco} · ` : ''}
                          DNI: {r.beneficiarios?.[0]?.dni || r.solicitanteDni || r.DNI || '—'}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.beneficiarios && r.beneficiarios.length > 1 ? (
                      <div className="space-y-1">
                        {r.beneficiarios.map((b, bi) => (
                          <div key={bi} className="text-xs">
                            <span className="font-bold text-primary">{fmtMonto(b.monto)}</span>
                            <span className="text-[10px] text-text-sec ml-1">({b.porcentaje}%)</span>
                          </div>
                        ))}
                        <div className="pt-0.5 border-t border-border-main text-[11px] font-bold text-text-main">
                          Total: {fmtMonto(Number(r.montoFinal ?? r.monto))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-text-main">{fmtMonto(Number(r.montoFinal ?? r.monto))}</span>
                        {r.descuentoCovid != null && r.descuentoCovid > 0 && (
                          <span className="block text-[10px] text-amber-600 font-medium" title={`Monto original: ${fmtMonto(r.monto)} · Descuento COVID: ${fmtMonto(r.descuentoCovid)}`}>
                            Dto. COVID {fmtMonto(r.descuentoCovid)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-sec whitespace-nowrap">{fmtFecha(r.fechaPago)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => router.push(`/dashboard/fam/expedientes/${r.id}`)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Ver detalle del expediente"
                      aria-label="Ver detalle del expediente">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50/40 font-semibold">
                <td className="px-4 py-3 text-sm text-text-main" colSpan={4}>Total · {filtradas.length} entrega{filtradas.length !== 1 ? 's' : ''}</td>
                <td className="px-4 py-3 text-sm font-bold text-primary">{fmtMonto(totalEntregado)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
