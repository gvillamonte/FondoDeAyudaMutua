'use client';

import { useState, useMemo, useCallback } from 'react';
import api from '@/lib/api';

interface Colegiado {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRES: string;
  APELLIDO_PATERNO: string;
  APELLIDO_MATERNO: string;
  ESTADO_COLEGIATURA: string;
  HABILITADO: number;
  FECHA_ULTIMO_PAGO: string | null;
  FECHA_HABILITADO: string | null;
  ESPECIALIDAD: string;
  TELEFONO: string;
  EMAIL: string;
  DIRECCION: string;
}

interface Cuota {
  cuotaId: string;
  anio: number;
  mes: number;
  monto: number;
  estadoPago: string;
  fechaVencimiento: string | null;
  fechaPago: string | null;
  comprobante: string;
  observaciones: string;
}

interface FraccionamientoData {
  colegiado: {
    id: string;
    cip: string;
    dni: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    nombreCompleto: string;
    estadoColegiatura: string;
    habilitado: boolean;
    fechaUltimoPago: string | null;
    fechaHabilitado: string | null;
    capitulo: string;
    telefono: string;
    email: string;
    direccion: string;
    fechaIngreso: string | null;
  };
  cuotas: Cuota[];
  resumenDeuda: {
    mesInicialDeuda: string;
    mesFinalDeuda: string;
    totalCuotasPendientes: number;
    deudaPorAportes: number;
    deudaPorMultas: number;
    deudaTotal: number;
    fechaUltimoPago: string | null;
    fechaHabilitado: string | null;
  };
}

const PORCENTAJES_FRACCIONAMIENTO = [
  { value: '5', label: '5% - CINCO PORCIENTO' },
  { value: '10', label: '10% - DIEZ PORCIENTO' },
  { value: '15', label: '15% - QUINCE PORCIENTO' },
  { value: '20', label: '20% - VEINTE PORCIENTO' },
  { value: '25', label: '25% - VEINTICINCO PORCIENTO' },
];

const NRO_CUOTAS = [
  { value: '3', label: '3 CUOTAS' },
  { value: '5', label: '5 CUOTAS' },
  { value: '6', label: '6 CUOTAS' },
  { value: '10', label: '10 CUOTAS' },
  { value: '12', label: '12 CUOTAS' },
  { value: '24', label: '24 CUOTAS' },
];

const MESES = [
  '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMesAnio(mes: number, anio: number): string {
  return `${String(mes).padStart(2, '0')}-${anio}`;
}

export default function FraccionamientoDeudaPage() {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Colegiado[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [error, setError] = useState('');

  const [datos, setDatos] = useState<FraccionamientoData | null>(null);
  const [porcentajeFraccionamiento, setPorcentajeFraccionamiento] = useState('5');
  const [nroCuotas, setNroCuotas] = useState('10');

  const handleSearch = useCallback(async () => {
    const term = busqueda.trim();
    if (!term) {
      setResultados([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/tesoreria/fraccionamiento/search', {
        params: { search: term },
      });
      setResultados(data.data || []);
      setShowDropdown(true);
    } catch {
      setError('Error al buscar colegiados');
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }, [busqueda]);

  const handleSelectColegiado = useCallback(async (colegiadoId: string) => {
    setShowDropdown(false);
    setBusqueda('');
    setLoadingDatos(true);
    setError('');
    setDatos(null);

    try {
      const { data } = await api.get(`/tesoreria/fraccionamiento/${colegiadoId}`);
      setDatos(data);
    } catch {
      setError('Error al cargar datos del colegiado');
    } finally {
      setLoadingDatos(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const datosFraccionamiento = useMemo(() => {
    if (!datos) return null;
    const porcentaje = Number(porcentajeFraccionamiento) / 100;
    const deudaTotal = datos.resumenDeuda.deudaTotal;
    const inicialAprox = Number((deudaTotal * porcentaje).toFixed(2));
    const saldo = Number((deudaTotal - inicialAprox).toFixed(2));

    return {
      deudaPorMultas: datos.resumenDeuda.deudaPorMultas,
      inicialAprox,
      saldo,
    };
  }, [datos, porcentajeFraccionamiento]);

  const cuotasAgrupadas = useMemo(() => {
    if (!datos) return [];
    const pendientes = datos.cuotas
      .filter((c) => c.estadoPago === 'PENDIENTE')
      .sort((a, b) => a.anio * 100 + a.mes - (b.anio * 100 + b.mes));

    const agrupadas: Record<string, { mes: string; concepto: string; monto: number; estado: string }[]> = {};
    pendientes.forEach((c) => {
      const key = `${c.anio}`;
      if (!agrupadas[key]) agrupadas[key] = [];
      agrupadas[key].push({
        mes: formatMesAnio(c.mes, c.anio),
        concepto: 'APORTE',
        monto: c.monto,
        estado: c.estadoPago,
      });
    });

    return Object.entries(agrupadas).flatMap(([anio, items]) => items);
  }, [datos]);

  return (
    <div className="space-y-6">
      {/* Barra de Búsqueda */}
      <div className="bg-gray-700 rounded-lg p-4 flex items-center gap-4 relative">
        <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por CIP, DNI o Nombre del Colegiado"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-text-main placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>

        {/* Dropdown de resultados */}
        {showDropdown && resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
            {resultados.map((c) => (
              <button
                key={c.COLEGIADO_ID}
                onClick={() => handleSelectColegiado(c.COLEGIADO_ID)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {c.APELLIDO_PATERNO} {c.APELLIDO_MATERNO}, {c.NOMBRES}
                    </p>
                    <p className="text-xs text-text-sec">
                      CIP: {c.NUM_COLEGIATURA} | DNI: {c.DNI} | {c.ESPECIALIDAD || 'S/C'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    c.HABILITADO === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {c.ESTADO_COLEGIATURA}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        {showDropdown && resultados.length === 0 && !loading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 p-4">
            <p className="text-sm text-text-sec text-center">No se encontraron colegiados</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loadingDatos && (
        <div className="bg-white rounded-lg shadow-sm border border-border-main p-12 flex items-center justify-center">
          <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-text-sec">Cargando datos del colegiado...</span>
        </div>
      )}

      {/* Datos del Colegiado y de la Deuda */}
      {datos && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-border-main p-6">
            <h2 className="text-lg font-bold text-primary mb-4">Datos del Colegiado y de la Deuda</h2>

            {/* Fila 1 */}
            <div className="grid grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Nombres</label>
                <input
                  type="text"
                  readOnly
                  value={datos.colegiado.nombreCompleto}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Nro. CIP</label>
                <input
                  type="text"
                  readOnly
                  value={datos.colegiado.cip}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Capítulo</label>
                <input
                  type="text"
                  readOnly
                  value={datos.colegiado.capitulo}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Fecha Último Pago</label>
                <input
                  type="text"
                  readOnly
                  value={formatDate(datos.resumenDeuda.fechaUltimoPago)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Fecha Habilitado</label>
                <input
                  type="text"
                  readOnly
                  value={formatDate(datos.resumenDeuda.fechaHabilitado)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
            </div>

            {/* Fila 2 */}
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Mes Inicial Deuda</label>
                <input
                  type="text"
                  readOnly
                  value={datos.resumenDeuda.mesInicialDeuda || '-'}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Mes Final Deuda</label>
                <input
                  type="text"
                  readOnly
                  value={datos.resumenDeuda.mesFinalDeuda || '-'}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Deuda por Multas</label>
                <input
                  type="text"
                  readOnly
                  value={datos.resumenDeuda.deudaPorMultas.toFixed(2)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Deuda por Aportes</label>
                <input
                  type="text"
                  readOnly
                  value={datos.resumenDeuda.deudaPorAportes.toFixed(2)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Deuda Total</label>
                <input
                  type="text"
                  readOnly
                  value={datos.resumenDeuda.deudaTotal.toFixed(2)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main font-bold"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Datos (Detalle de Cuotas) */}
          <div className="bg-white rounded-lg shadow-sm border border-border-main p-6">
            <h3 className="text-sm font-bold text-primary mb-3">
              Detalle de Cuotas Pendientes ({cuotasAgrupadas.length} registros)
            </h3>
            <div className="max-h-64 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-text-main">Mes</th>
                    <th className="text-left py-2 px-3 font-medium text-text-main">Concepto</th>
                    <th className="text-right py-2 px-3 font-medium text-text-main">Monto (S/)</th>
                    <th className="text-center py-2 px-3 font-medium text-text-main">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotasAgrupadas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-sec">
                        No hay cuotas pendientes
                      </td>
                    </tr>
                  ) : (
                    cuotasAgrupadas.map((cuota, index) => (
                      <tr
                        key={`${cuota.mes}-${index}`}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 text-text-main">{cuota.mes}</td>
                        <td className="py-2 px-3 text-text-main">{cuota.concepto}</td>
                        <td className="py-2 px-3 text-right text-text-main">{cuota.monto.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">
                            PENDIENTE
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card: Datos del Fraccionamiento */}
          <div className="bg-white rounded-lg shadow-sm border border-border-main p-6">
            <h2 className="text-lg font-bold text-primary mb-4">Datos del Fraccionamiento</h2>

            <div className="grid grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">% Fraccionamiento</label>
                <select
                  value={porcentajeFraccionamiento}
                  onChange={(e) => setPorcentajeFraccionamiento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {PORCENTAJES_FRACCIONAMIENTO.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Deuda por Multas</label>
                <input
                  type="text"
                  readOnly
                  value={datosFraccionamiento?.deudaPorMultas.toFixed(2) ?? '0.00'}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">INICIAL Aprox.</label>
                <input
                  type="text"
                  readOnly
                  value={datosFraccionamiento?.inicialAprox.toFixed(2) ?? '0.00'}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">SALDO</label>
                <input
                  type="text"
                  readOnly
                  value={datosFraccionamiento?.saldo.toFixed(2) ?? '0.00'}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec mb-1">Nro. Cuotas</label>
                <select
                  value={nroCuotas}
                  onChange={(e) => setNroCuotas(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {NRO_CUOTAS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-8">
              <div>
                <span className="text-xs font-medium text-text-sec">Centro de Labores: </span>
                <span className="text-sm text-text-main">CIP CUSCO</span>
              </div>
              <div>
                <span className="text-xs font-medium text-text-sec">Dirección: </span>
                <span className="text-sm text-text-main">{datos.colegiado.direccion || 'Sin dirección registrada'}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
