'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import * as XLSX from 'xlsx';

export interface ColegiadoActualizacionItem {
  id: string;
  colegiadoId: string;
  cip: string;
  dni: string;
  nombres: string;
  emailAnterior: string | null;
  emailNuevo: string;
  celularAnterior: string | null;
  celularNuevo: string;
  fechaNacimientoAnterior: string | null;
  fechaNacimientoNuevo: string | null;
  sexoAnterior: string | null;
  sexoNuevo: string | null;
  direccionAnterior: string | null;
  direccionNuevo: string | null;
  departamentoAnterior: string | null;
  departamentoNuevo: string | null;
  provinciaAnterior: string | null;
  provinciaNuevo: string | null;
  distritoAnterior: string | null;
  distritoNuevo: string | null;
  referenciaAnterior: string | null;
  referenciaNuevo: string | null;
  estadoCivilAnterior: string | null;
  estadoCivilNuevo: string | null;
  ipAddress: string;
  userAgent: string;
  estado: string;
  createdAt: string;
  updatedAt: string;
  fechaModificacion?: string;
  emailEnviado?: boolean;
}

function formatearFecha(f?: string | null): string {
  if (!f) return '-';
  const fecha = new Date(f);
  if (isNaN(fecha.getTime())) return f;
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatearHora(f?: string | null): string {
  if (!f) return '';
  const fecha = new Date(f);
  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function QuiénesActualizaronPage() {
  const [items, setItems] = useState<ColegiadoActualizacionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Modal Detalle de Última Modificación
  const [selectedItem, setSelectedItem] = useState<ColegiadoActualizacionItem | null>(null);
  const [exportando, setExportando] = useState(false);

  // Carga de datos (cada fila es la última modificación de un colegiado)
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = {
        page,
        limit,
      };
      if (search.trim()) params.search = search.trim();
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;

      const res = await api.get('/actualizacion-datos/historial', { params });
      const payload = res.data;
      setItems(payload.data || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al cargar las modificaciones de colegiados';
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, fechaDesde, fechaHasta]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarDatos();
  };

  const handleLimpiarFiltros = () => {
    setSearch('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
  };

  // Exportar a Excel
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;

      const res = await api.get('/actualizacion-datos/exportar', { params });
      const registros: ColegiadoActualizacionItem[] = res.data || [];

      if (registros.length === 0) {
        alert('No hay registros para exportar con los filtros seleccionados.');
        return;
      }

      const excelRows = registros.map((r, index) => {
        return {
          'N°': index + 1,
          'N° CIP': r.cip,
          'DNI': r.dni,
          'Colegiado': r.nombres,
          'Correo Electrónico': r.emailNuevo || '-',
          'Celular': r.celularNuevo || '-',
          'Fecha Nacimiento': r.fechaNacimientoNuevo || '-',
          'Sexo': r.sexoNuevo === 'M' ? 'Masculino' : r.sexoNuevo === 'F' ? 'Femenino' : (r.sexoNuevo || '-'),
          'Estado Civil': r.estadoCivilNuevo || '-',
          'Departamento': r.departamentoNuevo || '-',
          'Provincia': r.provinciaNuevo || '-',
          'Distrito': r.distritoNuevo || '-',
          'Dirección': r.direccionNuevo || '-',
          'Referencia': r.referenciaNuevo || '-',
          'Fecha de Actualización': new Date(r.updatedAt || r.createdAt).toLocaleString('es-PE'),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos_Actualizados');

      const fechaHoy = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Colegiados_Datos_Actualizados_${fechaHoy}.xlsx`);
    } catch (err: any) {
      alert('Error al exportar a Excel: ' + (err.message || 'Error desconocido'));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-blue-700 transition-colors">
              Inicio
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">Actualización de Datos</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Quiénes Actualizaron</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Padrón de Colegiados con Datos Actualizados
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Muestra la última modificación registrada por cada ingeniero colegiado y el estado de entrega de su correo.
          </p>
        </div>

        {/* Botón de Exportación */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={exportando || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors shadow-sm"
          >
            {exportando ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exportando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Informativas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4 shadow-sm bg-white" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Colegiados Actualizados
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              CIP
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">ingenieros con datos vigentes</span>
          </div>
        </div>

        <div className="rounded-xl border p-4 shadow-sm bg-white" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Criterio de Registro
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-slate-900">Última Modificación</span>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Activa</span>
          </div>
        </div>

        <div className="rounded-xl border p-4 shadow-sm bg-white" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Validación y Envío
            </span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              ✉
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-slate-900">Constancia Oficial</span>
            <span className="text-xs text-slate-500">Control por colegiado</span>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="rounded-xl border p-4 shadow-sm bg-white" style={{ borderColor: '#E2E8F0' }}>
        <form onSubmit={handleFiltrar} className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por CIP, DNI, Colegiado, Correo, Celular o Distrito..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent text-slate-800"
              style={{ borderColor: '#E2E8F0' }}
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none text-slate-700 bg-white"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none text-slate-700 bg-white"
                style={{ borderColor: '#E2E8F0' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-white text-xs font-semibold shadow-sm transition-colors duration-150 flex-1 md:flex-none"
              style={{ backgroundColor: '#3258CA' }}
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="px-3 py-2 rounded-lg text-xs font-medium border bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              style={{ borderColor: '#E2E8F0' }}
            >
              Limpiar
            </button>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2.5 py-2 text-xs rounded-lg border bg-white focus:outline-none text-slate-700"
              style={{ borderColor: '#E2E8F0' }}
            >
              <option value={10}>10 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>
          </div>
        </form>
      </div>

      {/* TABLA: CADA INGENIERO APARECE UNA SOLA VEZ CON SU ÚLTIMA MODIFICACIÓN */}
      <div className="rounded-xl border shadow-sm bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-xs sm:text-sm border-b border-red-100 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={cargarDatos} className="underline font-semibold ml-2">Reintentar</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold text-slate-600 bg-slate-50 uppercase tracking-wider" style={{ borderColor: '#E2E8F0' }}>
                <th className="py-3 px-4">Colegiado</th>
                <th className="py-3 px-3">CIP</th>
                <th className="py-3 px-3">DNI</th>
                <th className="py-3 px-4">Última Modificación</th>
                <th className="py-3 px-4">Correo Actual</th>
                <th className="py-3 px-4">Celular Actual</th>
                <th className="py-3 px-4">Ubicación / Distrito</th>
                <th className="py-3 px-4 text-center">¿Correo Enviado?</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Cargando colegiados...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-700">No se encontraron colegiados</p>
                      <p className="text-xs text-slate-500">
                        {search || fechaDesde || fechaHasta
                          ? 'Pruebe ajustando o limpiando los filtros de búsqueda.'
                          : 'Aún no se han registrado modificaciones de datos en el portal.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const fechaMod = row.fechaModificacion || row.updatedAt || row.createdAt;
                  const esCorreoEnviado = row.emailEnviado || row.estado === 'EMAIL_ENVIADO';
                  const esCorreoFallido = row.estado === 'EMAIL_NO_ENVIADO';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer"
                      onClick={() => setSelectedItem(row)}
                    >
                      {/* Colegiado */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(row); }}
                          className="text-left font-bold text-slate-900 hover:text-blue-700 transition-colors group"
                        >
                          <span className="group-hover:underline block leading-tight">{row.nombres}</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {row.distritoNuevo ? `${row.distritoNuevo}, ${row.departamentoNuevo || ''}` : 'Ubicación no especificada'}
                          </span>
                        </button>
                      </td>

                      {/* CIP */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {row.cip}
                      </td>

                      {/* DNI */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {row.dni}
                      </td>

                      {/* Fecha de Última Modificación */}
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {formatearFecha(fechaMod)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatearHora(fechaMod)}
                        </div>
                      </td>

                      {/* Correo Actual */}
                      <td className="py-3 px-4 text-xs max-w-[200px] truncate text-slate-700" title={row.emailNuevo}>
                        <span className="font-medium text-slate-900">{row.emailNuevo}</span>
                      </td>

                      {/* Celular Actual */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-800 whitespace-nowrap">
                        {row.celularNuevo}
                      </td>

                      {/* Ubicación / Distrito */}
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {row.distritoNuevo ? (
                          <span>
                            <strong className="text-slate-900">{row.distritoNuevo}</strong>
                            {row.provinciaNuevo && <span className="text-slate-400">, {row.provinciaNuevo}</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* ¿Se llegó a enviar el correo? */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {esCorreoEnviado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            ✓ Enviado
                          </span>
                        ) : esCorreoFallido ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            ✕ No enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            ✓ Registrado
                          </span>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(row); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
                          style={{ backgroundColor: '#3258CA' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600" style={{ borderColor: '#E2E8F0' }}>
          <div>
            Mostrando {total > 0 ? (page - 1) * limit + 1 : 0} a {Math.min(page * limit, total)} de{' '}
            <span className="font-semibold text-slate-800">{total}</span> colegiados
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors font-medium text-slate-700"
              style={{ borderColor: '#E2E8F0' }}
            >
              Anterior
            </button>
            <span className="px-3 py-1 font-semibold text-slate-800">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors font-medium text-slate-700"
              style={{ borderColor: '#E2E8F0' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL: DETALLE DE LA ÚLTIMA MODIFICACIÓN DEL COLEGIADO               */}
      {/* ==================================================================== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div
            className="rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border bg-white animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
            style={{ borderColor: '#E2E8F0' }}
          >
            {/* Header del Modal */}
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{ backgroundColor: '#3258CA' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    Última Modificación de Datos del Colegiado
                  </h3>
                  <p className="text-xs text-blue-100">
                    Ficha oficial con los datos vigentes y estado de envío de constancia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm font-bold"
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Tarjeta del Colegiado Titular */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                      Colegiado Titular:
                    </span>
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                      {selectedItem.nombres}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        CIP: {selectedItem.cip}
                      </span>
                      <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        DNI: {selectedItem.dni}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs text-slate-500 block">Fecha Última Modificación:</span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      {formatearFecha(selectedItem.fechaModificacion || selectedItem.updatedAt || selectedItem.createdAt)}
                    </span>
                    <span className="text-xs text-slate-500 block">
                      {formatearHora(selectedItem.fechaModificacion || selectedItem.updatedAt || selectedItem.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BANNER DESTACADO DE SI SE LLEGÓ A ENVIAR EL CORREO */}
              {selectedItem.estado === 'EMAIL_ENVIADO' || selectedItem.emailEnviado ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                      ✓
                    </span>
                    <div>
                      <span className="font-bold text-sm block text-emerald-900">
                        Correo de Constancia Despachado con Éxito
                      </span>
                      <span className="text-emerald-800">
                        El sistema envió automáticamente la constancia oficial a <strong>{selectedItem.emailNuevo}</strong>.
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-800 font-bold shrink-0 ml-2">
                    SMTP Éxito
                  </span>
                </div>
              ) : selectedItem.estado === 'EMAIL_NO_ENVIADO' ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                      ✕
                    </span>
                    <div>
                      <span className="font-bold text-sm block text-amber-900">
                        Constancia por Correo NO Despachada
                      </span>
                      <span className="text-amber-800">
                        El envío no se completó (servidor SMTP no disponible o dirección rechazada).
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-amber-300 text-amber-800 font-bold shrink-0 ml-2">
                    Fallo / Simulación
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                      ℹ
                    </span>
                    <div>
                      <span className="font-bold text-sm block text-slate-900">
                        Modificación Registrada en Padrón
                      </span>
                      <span className="text-slate-600">
                        Datos registrados válidamente en la base de datos institucional.
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 font-bold shrink-0 ml-2">
                    Registrado
                  </span>
                </div>
              )}

              {/* COMPARATIVA DE DATOS MODIFICADOS (ANTES VS DESPUÉS) */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Comparativa de Datos Modificados
                </h5>

                <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b">
                        <th className="py-2.5 px-3">Campo</th>
                        <th className="py-2.5 px-3">Dato Anterior</th>
                        <th className="py-2.5 px-3">Dato Actualizado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Correo */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Correo Electrónico</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.emailAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-700 bg-blue-50/30">
                          {selectedItem.emailNuevo}
                        </td>
                      </tr>

                      {/* Celular */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Teléfono / Celular</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.celularAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                          {selectedItem.celularNuevo}
                        </td>
                      </tr>

                      {/* Fecha Nacimiento */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Fecha de Nacimiento</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.fechaNacimientoAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {selectedItem.fechaNacimientoNuevo || '(Sin cambios)'}
                        </td>
                      </tr>

                      {/* Sexo */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Sexo</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.sexoAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {selectedItem.sexoNuevo === 'M' ? 'Masculino' : selectedItem.sexoNuevo === 'F' ? 'Femenino' : selectedItem.sexoNuevo || '(Sin cambios)'}
                        </td>
                      </tr>

                      {/* Estado Civil */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Estado Civil</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.estadoCivilAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 bg-purple-50/20">
                          {selectedItem.estadoCivilNuevo || '(Sin cambios)'}
                        </td>
                      </tr>

                      {/* Ubicación / Distrito */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Ubicación (Distrito / Prov. / Dpto.)</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {[selectedItem.distritoAnterior, selectedItem.provinciaAnterior, selectedItem.departamentoAnterior].filter(Boolean).join(' - ') || '(Vacío)'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 bg-blue-50/20">
                          {[selectedItem.distritoNuevo, selectedItem.provinciaNuevo, selectedItem.departamentoNuevo].filter(Boolean).join(' - ') || '(Sin cambios)'}
                        </td>
                      </tr>

                      {/* Dirección */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Dirección Domiciliaria</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.direccionAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {selectedItem.direccionNuevo || '(Sin cambios)'}
                        </td>
                      </tr>

                      {/* Referencia */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">Referencia</td>
                        <td className="py-2.5 px-3 text-slate-500">{selectedItem.referenciaAnterior || '(Vacío)'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {selectedItem.referenciaNuevo || '(Sin cambios)'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Auditoría Técnica */}
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-500 border border-slate-200">
                <p><strong>Dirección IP:</strong> <span className="font-mono text-slate-800">{selectedItem.ipAddress || 'unknown'}</span></p>
                <p className="truncate"><strong>Navegador / Dispositivo:</strong> <span className="text-slate-800">{selectedItem.userAgent || 'unknown'}</span></p>
                <p><strong>Identificador Único:</strong> <span className="font-mono text-slate-700">{selectedItem.id}</span></p>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
              <span className="text-xs text-slate-500">
                Última modificación registrada en el padrón institucional
              </span>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors"
                style={{ backgroundColor: '#3258CA' }}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
