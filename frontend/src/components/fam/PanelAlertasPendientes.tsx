'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export interface AlertaItem {
  id: string;
  expedienteNumero?: string | null;
  colegiadoId: string;
  nombreColegiado: string;
  numColegiatura: string;
  dni: string;
  tipoBeneficio: string;
  estado: string;
  monto: number;
  diasRetraso?: number;
  horasRestantes?: number;
  horasLimite?: number;
  condicion?: 'VENCIDO' | 'POR_VENCER';
  documentacionObservacion?: string | null;
  saldoPendiente?: number;
  createdAt?: string | Date;
}

export interface AlertasPendientesData {
  totalAlertas: number;
  vencidosCount: number;
  porVencerCount: number;
  docsIncompletosCount: number;
  saldoPendienteCount: number;
  vencidos: AlertaItem[];
  porVencer: AlertaItem[];
  docsIncompletos: AlertaItem[];
  saldoPendiente: AlertaItem[];
}

interface PanelAlertasPendientesProps {
  alertas: AlertasPendientesData | null;
  onFiltrarEnTabla?: (tipo: string, ids?: string) => void;
  className?: string;
}

type TabAlerta = 'vencidos' | 'porVencer' | 'docsIncompletos' | 'saldoPendiente';

const ESTADO_BADGE_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  EN_REVISION: 'bg-red-50 text-[#8f0404] border-red-200',
  APROBADA: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PAGADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RECHAZADA: 'bg-red-50 text-red-700 border-red-200',
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En Revisión',
  APROBADA: 'Aprobada',
  PAGADA: 'Pagada',
  RECHAZADA: 'Rechazada',
};

export const PanelAlertasPendientes: React.FC<PanelAlertasPendientesProps> = ({
  alertas,
  onFiltrarEnTabla,
  className = '',
}) => {
  const [colapsado, setColapsado] = useState(false);
  const [tabActiva, setTabActiva] = useState<TabAlerta>('vencidos');
  const [busqueda, setBusqueda] = useState('');

  if (!alertas || alertas.totalAlertas === 0) {
    return null;
  }

  const itemsTabActual: AlertaItem[] = useMemo(() => {
    switch (tabActiva) {
      case 'vencidos':
        return alertas.vencidos || [];
      case 'porVencer':
        return alertas.porVencer || [];
      case 'docsIncompletos':
        return alertas.docsIncompletos || [];
      case 'saldoPendiente':
        return alertas.saldoPendiente || [];
      default:
        return [];
    }
  }, [alertas, tabActiva]);

  const itemsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return itemsTabActual;
    const q = busqueda.toLowerCase().trim();
    return itemsTabActual.filter((item) => {
      const exp = (item.expedienteNumero || '').toLowerCase();
      const col = (item.nombreColegiado || '').toLowerCase();
      const cip = (item.numColegiatura || '').toLowerCase();
      const dni = (item.dni || '').toLowerCase();
      return exp.includes(q) || col.includes(q) || cip.includes(q) || dni.includes(q);
    });
  }, [itemsTabActual, busqueda]);

  const formatearMonto = (num?: number | null) => {
    return `S/ ${(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const tabsConfig = [
    {
      key: 'vencidos' as TabAlerta,
      label: 'SLA Crítico / Vencidos',
      count: alertas.vencidosCount,
      badgeColor: 'bg-red-100 text-red-800 border-red-200',
      activeTabClass: 'border-red-600 text-red-700 bg-red-50/50',
      icon: (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'porVencer' as TabAlerta,
      label: 'Próximos a Vencer (<12h)',
      count: alertas.porVencerCount,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      activeTabClass: 'border-amber-600 text-amber-700 bg-amber-50/50',
      icon: (
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'docsIncompletos' as TabAlerta,
      label: 'Documentos Incompletos',
      count: alertas.docsIncompletosCount,
      badgeColor: 'bg-red-100 text-[#8f0404] border-red-200',
      activeTabClass: 'border-[#8f0404] text-[#8f0404] bg-red-50/50',
      icon: (
        <svg className="w-4 h-4 text-[#8f0404]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: 'saldoPendiente' as TabAlerta,
      label: 'Saldos Pendientes',
      count: alertas.saldoPendienteCount,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      activeTabClass: 'border-purple-600 text-purple-700 bg-purple-50/50',
      icon: (
        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`border border-border-main bg-white rounded-xl shadow-sm overflow-hidden transition-all ${className}`}>
      {/* Encabezado del Panel con interruptor de colapso */}
      <div className="px-4 py-3 bg-slate-50 border-b border-border-main flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                Panel de Alertas para Pendientes
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white animate-pulse">
                {alertas.totalAlertas} {alertas.totalAlertas === 1 ? 'alerta' : 'alertas'}
              </span>
            </div>
            <p className="text-[11px] text-text-sec mt-0.5">
              Supervisión en tiempo real de plazos vencidos, falta de requisitos y saldos por liquidar
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setColapsado(!colapsado)}
          className="text-xs font-semibold text-[#8f0404] hover:text-[#730202] p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors inline-flex items-center gap-1"
        >
          <span>{colapsado ? 'Mostrar panel' : 'Minimizar'}</span>
          <svg
            className={`w-4 h-4 transform transition-transform ${colapsado ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Contenido desplegable */}
      {!colapsado && (
        <div className="p-4 space-y-4">
          {/* Navegación por Pestañas de Alertas */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border-main pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {tabsConfig.map((tab) => {
                const esActiva = tabActiva === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTabActiva(tab.key)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      esActiva
                        ? `${tab.activeTabClass} shadow-2xs`
                        : 'border-border-main bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${tab.badgeColor}`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-full sm:w-60">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por CIP o colegiado..."
                className="w-full px-2.5 py-1 text-xs border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              />
            </div>
          </div>

          {/* Listado de expedientes con alerta */}
          <div className="overflow-x-auto max-h-64 border border-border-main rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-border-main">
                <tr>
                  <th className="py-2 px-3">Expediente</th>
                  <th className="py-2 px-3">Colegiado (CIP / DNI)</th>
                  <th className="py-2 px-3">Beneficio</th>
                  <th className="py-2 px-3">Estado</th>
                  <th className="py-2 px-3">
                    {tabActiva === 'vencidos'
                      ? 'Días de Retraso'
                      : tabActiva === 'porVencer'
                      ? 'Horas Restantes'
                      : tabActiva === 'docsIncompletos'
                      ? 'Observación Documental'
                      : 'Saldo Faltante'}
                  </th>
                  <th className="py-2 px-3 text-right">Monto</th>
                  <th className="py-2 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main text-slate-700 bg-white">
                {itemsFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-semibold text-[#8f0404]">
                      {item.expedienteNumero || 'S/N'}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-900 truncate max-w-[190px]" title={item.nombreColegiado}>
                        {item.nombreColegiado}
                      </div>
                      <div className="text-[10px] text-text-sec">
                        CIP: {item.numColegiatura} · DNI: {item.dni}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-600 truncate max-w-[140px]" title={item.tipoBeneficio}>
                      {item.tipoBeneficio}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${
                          ESTADO_BADGE_STYLE[item.estado] || 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {ESTADO_LABELS[item.estado] || item.estado}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {tabActiva === 'vencidos' && (
                        <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                          Vencido ({item.diasRetraso || 1} d de retraso)
                        </span>
                      )}
                      {tabActiva === 'porVencer' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                          Restan {item.horasRestantes || 1} horas
                        </span>
                      )}
                      {tabActiva === 'docsIncompletos' && (
                        <span className="text-[11px] text-slate-600 line-clamp-1" title={item.documentacionObservacion || 'Documentación incompleta'}>
                          {item.documentacionObservacion || 'Requisitos pendientes de carga'}
                        </span>
                      )}
                      {tabActiva === 'saldoPendiente' && (
                        <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px]">
                          Faltante: {formatearMonto(item.saldoPendiente)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {formatearMonto(item.monto)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/dashboard/fam/expedientes/${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#8f0404] rounded hover:bg-[#730202] transition-colors"
                        >
                          Ver Exp.
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {itemsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No hay expedientes pendientes en esta categoría.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelAlertasPendientes;

