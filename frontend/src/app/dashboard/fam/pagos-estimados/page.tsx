'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';

interface ColegiadoFAM {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
}

interface BeneficiarioRow {
  FAM_ID: string;
  NOMBRE_BENEFICIARIO: string;
  DNI: string;
  PARENTESCO: string;
  PORCENTAJE: number;
}

interface MontoFamConfig {
  id: number;
  nombre: string;
  aplicaA: string | null;
  monto: number;
}

interface FilaTabla {
  colegiadoId: string;
  cip: string;
  colegiado: string;
  estado: string;
  beneficiario: string;
  dni: string;
  parentesco: string;
  porcentaje: number;
  beneficioNombre: string;
  montoBase: number;
  descuentoCovid: number;
  neto: number;
  corresponde: number;
}

const fmtMonto = (m: number) => `S/ ${m.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function PagosEstimadosPage() {
  const [filas, setFilas] = useState<FilaTabla[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [colegiadosRes, montosRes] = await Promise.all([
        api.get('/fam/beneficiarios', { params: { page: 1, limit: 500 } }),
        api.get('/configuraciones/montos-fam'),
      ]);

      const colegiados: ColegiadoFAM[] = Array.isArray(colegiadosRes.data?.data) ? colegiadosRes.data.data : [];
      const montos: MontoFamConfig[] = (Array.isArray(montosRes.data) ? montosRes.data : []).filter((m: MontoFamConfig) => m.monto > 0);

      const resultados: FilaTabla[] = [];
      const batchSize = 10;

      for (let i = 0; i < colegiados.length; i += batchSize) {
        const batch = colegiados.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (col) => {
            const [benData, covidData] = await Promise.all([
              api.get(`/fam/colegiado/${col.COLEGIADO_ID}/beneficiarios`).catch(() => ({ data: [] })),
              api.get(`/fam-covid/colegiado/${col.COLEGIADO_ID}`).catch(() => ({ data: null })),
            ]);

            const beneficiarios: BeneficiarioRow[] = Array.isArray(benData.data) ? benData.data : [];
            const covidMonto = covidData.data?.tieneAsignacion ? (covidData.data.monto || 0) : 0;

            const filasCol: FilaTabla[] = [];
            for (const b of beneficiarios) {
              for (const m of montos) {
                const esFallecimiento = (m.aplicaA || '').toUpperCase() === 'FALLECIMIENTO';
                const descuento = esFallecimiento ? covidMonto : 0;
                const neto = Math.max(0, m.monto - descuento);
                const corresponde = (b.PORCENTAJE / 100) * neto;
                filasCol.push({
                  colegiadoId: col.COLEGIADO_ID,
                  cip: col.NUM_COLEGIATURA,
                  colegiado: col.NOMBRE_COLEGIADO,
                  estado: col.ESTADO,
                  beneficiario: b.NOMBRE_BENEFICIARIO,
                  dni: b.DNI || '-',
                  parentesco: b.PARENTESCO,
                  porcentaje: b.PORCENTAJE,
                  beneficioNombre: m.nombre,
                  montoBase: m.monto,
                  descuentoCovid: descuento,
                  neto,
                  corresponde,
                });
              }
            }
            return filasCol;
          }),
        );
        for (const filasBatch of batchResults) resultados.push(...filasBatch);
      }

      setFilas(resultados);
    } catch {
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search]);

  const filasFiltradas = filas.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.cip.toLowerCase().includes(q) ||
      f.colegiado.toLowerCase().includes(q) ||
      f.beneficiario.toLowerCase().includes(q) ||
      f.dni.includes(q)
    );
  });

  const totalPages = Math.ceil(filasFiltradas.length / limit);
  const filasPagina = filasFiltradas.slice((page - 1) * limit, page * limit);

  const totalCorresponde = filasFiltradas.reduce((acc, f) => acc + f.corresponde, 0);

  const handleExportar = () => {
    if (!filasFiltradas.length) { alert('No hay datos para exportar.'); return; }
    const ws = XLSX.utils.json_to_sheet(filasFiltradas.map((f) => ({
      'CIP': f.cip,
      'Colegiado': f.colegiado,
      'Estado': f.estado,
      'Beneficiario': f.beneficiario,
      'DNI': f.dni,
      'Parentesco': f.parentesco,
      '% Asignado': f.porcentaje,
      'Beneficio': f.beneficioNombre,
      'Monto Base S/': f.montoBase,
      'Descuento COVID S/': f.descuentoCovid || '',
      'Monto Neto S/': f.neto,
      'Corresponde S/': f.corresponde,
    })));
    ws['!cols'] = [
      { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos Estimados');
    XLSX.writeFile(wb, `Pagos_Estimados_FAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Pagos Estimados FAM</h2>
          <p className="text-text-sec text-sm mt-1">Detalle de montos por beneficiario seg&uacute;n beneficios configurados</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-green-700">Total estimado: {fmtMonto(totalCorresponde)}</span>
          <button onClick={handleExportar}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Descargar Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <input type="text" placeholder="Buscar por CIP, nombre, beneficiario o DNI..." value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
            className="flex-1 max-w-md px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={() => { setSearch(searchInput); setPage(1); }}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">Buscar</button>
          {search && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              className="px-3 py-2 text-sm text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Limpiar</button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-text-sec">Mostrar</span>
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span className="text-sm text-text-sec">por p&aacute;gina</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['CIP', 'Colegiado', 'Beneficiario', 'DNI', 'Parentesco', '%', 'Beneficio', 'Mto. Base', 'Dcto. COVID', 'Neto', 'Corresponde'].map((label) => (
                  <th key={label} className="px-3 py-3 text-left text-xs font-semibold text-text-sec uppercase tracking-wider whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center">
                  <div className="inline-flex items-center gap-2 text-text-sec">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Cargando datos...
                  </div>
                </td></tr>
              ) : filasPagina.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-text-sec">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p className="text-sm">No se encontraron registros</p>
                </td></tr>
              ) : (
                filasPagina.map((f, idx) => (
                  <tr key={`${f.colegiadoId}-${f.beneficiario}-${f.beneficioNombre}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-sm font-semibold text-primary whitespace-nowrap">{f.cip}</td>
                    <td className="px-3 py-2 text-sm text-text-main max-w-[200px] truncate" title={f.colegiado}>{f.colegiado}</td>
                    <td className="px-3 py-2 text-sm text-text-main">{f.beneficiario}</td>
                    <td className="px-3 py-2 text-sm text-text-sec">{f.dni}</td>
                    <td className="px-3 py-2"><span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">{f.parentesco}</span></td>
                    <td className="px-3 py-2 text-sm font-semibold text-text-main text-right">{f.porcentaje}%</td>
                    <td className="px-3 py-2 text-sm text-text-sec">{f.beneficioNombre}</td>
                    <td className="px-3 py-2 text-sm text-text-main text-right whitespace-nowrap">{fmtMonto(f.montoBase)}</td>
                    <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                      {f.descuentoCovid > 0 ? <span className="text-amber-600">{fmtMonto(f.descuentoCovid)}</span> : <span className="text-text-sec">-</span>}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-text-main text-right whitespace-nowrap">{fmtMonto(f.neto)}</td>
                    <td className="px-3 py-2 text-sm font-bold text-green-700 text-right whitespace-nowrap">{fmtMonto(f.corresponde)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-gray-50">
          <p className="text-sm text-text-sec">{filasFiltradas.length > 0 ? `Mostrando ${(page - 1) * limit + 1} a ${Math.min(page * limit, filasFiltradas.length)} de ${filasFiltradas.length.toLocaleString('es-PE')} filas` : 'Sin registros'}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'<<'}</button>
            <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'<'}</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const start = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = start + i; if (p > totalPages) return null; return (<button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-sm rounded border ${page === p ? 'bg-primary text-white border-primary' : 'border-border hover:bg-white'}`}>{p}</button>); })}
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'>'}</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'>>'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
