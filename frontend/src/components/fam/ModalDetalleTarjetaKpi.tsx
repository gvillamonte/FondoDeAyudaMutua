'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export type TipoTarjetaKpi = 'montodado' | 'pendientes' | 'vencer' | 'saldopendiente' | 'total';

interface ExpedienteItem {
  id: string;
  expedienteNumero?: string | null;
  colegiadoId: string;
  nombreColegiado: string;
  numColegiatura: string;
  dni: string;
  tipoBeneficio: string;
  estado: string;
  monto: number;
  // Campos específicos
  saldoPendiente?: number;
  montoAprobadoTotal?: number;
  motivoSaldoPendiente?: string;
  diasRetraso?: number;
  horasRestantes?: number;
  horasLimite?: number;
  condicion?: 'VENCIDO' | 'POR_VENCER';
  condicionSla?: string;
  diasEspera?: number;
  fechaPago?: string | Date | null;
  formaPago?: string | null;
  banco?: string | null;
  numeroCuenta?: string | null;
  createdAt?: string | Date;
}

interface ModalDetalleTarjetaKpiProps {
  isOpen: boolean;
  onClose: () => void;
  tipoTarjeta: TipoTarjetaKpi;
  dashboard: any;
  onAplicarFiltroTabla: (tipo: TipoTarjetaKpi) => void;
}

const ESTADO_BADGE_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  EN_REVISION: 'bg-blue-50 text-blue-700 border-blue-200',
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

export const ModalDetalleTarjetaKpi: React.FC<ModalDetalleTarjetaKpiProps> = ({
  isOpen,
  onClose,
  tipoTarjeta,
  dashboard,
  onAplicarFiltroTabla,
}) => {
  const [busqueda, setBusqueda] = useState('');

  if (!isOpen || !dashboard) return null;

  const infoTarjeta = useMemo(() => {
    switch (tipoTarjeta) {
      case 'montodado':
        return {
          titulo: 'Monto Total Dado',
          subtitulo: 'Desembolsos económicos y beneficios entregados a beneficiarios o colegiados',
          descripcion:
            'Esta tarjeta calcula la suma total del dinero efectivamente entregado en expedientes en estado PAGADA y aquellos con depósitos o pagos registrados. Muestra el número de entregas concluidas y el canal de desembolso.',
          colorClase: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          badgeText: `${dashboard.pagadosCount || 0} entregas pagadas`,
          items: (dashboard.ultimosPagadosList || []) as ExpedienteItem[],
        };
      case 'pendientes':
        return {
          titulo: 'Mis Pendientes (Expedientes Activos)',
          subtitulo: 'Expedientes que están en proceso de revisión, aprobación o desembolso',
          descripcion:
            'Esta tarjeta reúne todos los expedientes que se encuentran actualmente abiertos y requieren acción administrativa (estados PENDIENTE, EN REVISIÓN y APROBADA).',
          colorClase: 'text-amber-700 bg-amber-50 border-amber-200',
          badgeText: `${dashboard.misTendientes || 0} en trámite`,
          items: (dashboard.pendientesList || []) as ExpedienteItem[],
        };
      case 'vencer':
        return {
          titulo: 'Próximos a Vencer y Vencidos (SLA)',
          subtitulo: 'Expedientes que han superado el plazo de atención establecido o están por alcanzarlo',
          descripcion:
            'Control de plazos de atención (SLA). Considera vencido cualquier expediente que supera las horas máximas configuradas para su estado (por defecto 72 horas). Por vencer incluye expedientes con menos de 12 horas restantes.',
          colorClase: 'text-red-700 bg-red-50 border-red-200',
          badgeText: `${dashboard.vencidos || 0} vencidos · ${(dashboard.proximosAVencer || 0) - (dashboard.vencidos || 0)} por vencer`,
          items: (dashboard.vencidosList || []) as ExpedienteItem[],
        };
      case 'saldopendiente':
        return {
          titulo: 'Saldo Pendiente por Liquidar',
          subtitulo: 'Expedientes con montos retenidos o faltantes para completar la cobertura normada',
          descripcion:
            'Muestra los expedientes donde no se pudo transferir el 100% del beneficio (por falta de datos bancarios de herederos, carta poder pendiente o procesos de sucesión intestada). Permite regularizar entregando el saldo.',
          colorClase: 'text-amber-800 bg-amber-50 border-amber-300',
          badgeText: `S/ ${(dashboard.saldoPendienteTotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })} faltante`,
          items: (dashboard.saldoPendienteList || []) as ExpedienteItem[],
        };
      case 'total':
      default:
        return {
          titulo: 'Total de Expedientes Registrados',
          subtitulo: 'Padrón histórico completo de expedientes del Fondo de Ayuda Mutua (FAM)',
          descripcion:
            'Resume el universo total de expedientes registrados en el sistema, distribuidos por su estado administrativo (Pagados, Pendientes, En Revisión, Aprobados y Rechazados) y modalidad.',
          colorClase: 'text-[#3258CA] bg-blue-50 border-blue-200',
          badgeText: `${dashboard.totalExpedientes || 0} expedientes en total`,
          items: [] as ExpedienteItem[],
        };
    }
  }, [tipoTarjeta, dashboard]);

  // Filtrado de items por buscador local
  const itemsFiltrados = useMemo(() => {
    const list = infoTarjeta.items;
    if (!busqueda.trim()) return list;
    const q = busqueda.toLowerCase().trim();
    return list.filter((item) => {
      const expNum = (item.expedienteNumero || '').toLowerCase();
      const colNombre = (item.nombreColegiado || '').toLowerCase();
      const cip = (item.numColegiatura || '').toLowerCase();
      const dni = (item.dni || '').toLowerCase();
      const tipo = (item.tipoBeneficio || '').toLowerCase();
      return expNum.includes(q) || colNombre.includes(q) || cip.includes(q) || dni.includes(q) || tipo.includes(q);
    });
  }, [infoTarjeta.items, busqueda]);

  const formatearMonto = (num?: number | null) => {
    return `S/ ${(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleFiltrarEnTablaPrincipal = () => {
    onAplicarFiltroTabla(tipoTarjeta);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-slideUp"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${infoTarjeta.colorClase}`}>
                {infoTarjeta.badgeText}
              </span>
              <h3 className="text-lg font-bold text-slate-800">{infoTarjeta.titulo}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">{infoTarjeta.subtitulo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Cerrar ventana"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 text-sm">
          {/* Explicación institucional de la tarjeta */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 flex items-start gap-3">
            <svg className="w-5 h-5 text-[#3258CA] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900 block mb-0.5">¿Qué mide y cómo se calcula esta tarjeta?</span>
              {infoTarjeta.descripcion}
            </div>
          </div>

          {/* Desglose contextual adicional según tarjeta */}
          {tipoTarjeta === 'montodado' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Por Forma de Pago
                </span>
                <div className="space-y-1.5">
                  {(dashboard.porFormaPago || []).map((fp: any) => (
                    <div key={fp.formaPago} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">{fp.formaPago} ({fp.count})</span>
                      <span className="font-semibold text-slate-900">{formatearMonto(fp.monto)}</span>
                    </div>
                  ))}
                  {(!dashboard.porFormaPago || dashboard.porFormaPago.length === 0) && (
                    <p className="text-xs text-slate-400">Sin datos de formas de pago</p>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Por Banco de Depósito
                </span>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {(dashboard.porBanco || []).slice(0, 5).map((b: any) => (
                    <div key={b.banco} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 truncate max-w-[150px]">{b.banco} ({b.count})</span>
                      <span className="font-semibold text-slate-900">{formatearMonto(b.monto)}</span>
                    </div>
                  ))}
                  {(!dashboard.porBanco || dashboard.porBanco.length === 0) && (
                    <p className="text-xs text-slate-400">Sin datos bancarios registrados</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tipoTarjeta === 'total' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Distribución por Estado Administrativo
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {(dashboard.porEstadoTotal || []).map((est: any) => (
                    <div key={est.estado} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/70 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                        {ESTADO_LABELS[est.estado] || est.estado}
                      </span>
                      <span className="text-lg font-bold text-slate-800 block mt-1">{est.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Distribución por Tipo de Beneficio FAM
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(dashboard.porTipo || []).map((t: any) => (
                    <div key={t.nombre} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-700">{t.nombre}</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {t.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Listado de Expedientes que componen la tarjeta */}
          {infoTarjeta.items.length > 0 && (
            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-700">
                  Expedientes en este grupo ({itemsFiltrados.length} de {infoTarjeta.items.length})
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por colegiado, CIP o exp..."
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#3258CA]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Expediente</th>
                      <th className="py-2 px-3">Colegiado (CIP / DNI)</th>
                      <th className="py-2 px-3">Tipo de Beneficio</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3 text-right">Monto</th>
                      {tipoTarjeta === 'vencer' && <th className="py-2 px-3">SLA / Retraso</th>}
                      {tipoTarjeta === 'saldopendiente' && <th className="py-2 px-3 text-right">Saldo Faltante</th>}
                      <th className="py-2 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {itemsFiltrados.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-semibold text-[#3258CA]">
                          {item.expedienteNumero || 'S/N'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900 truncate max-w-[200px]" title={item.nombreColegiado}>
                            {item.nombreColegiado}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            CIP: {item.numColegiatura} · DNI: {item.dni}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
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
                        <td className="py-2 px-3 text-right font-semibold text-slate-800">
                          {formatearMonto(item.monto)}
                        </td>
                        {tipoTarjeta === 'vencer' && (
                          <td className="py-2 px-3">
                            {item.condicion === 'VENCIDO' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                Vencido ({item.diasRetraso || 1} d)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                Restan {item.horasRestantes || 1} h
                              </span>
                            )}
                          </td>
                        )}
                        {tipoTarjeta === 'saldopendiente' && (
                          <td className="py-2 px-3 text-right font-bold text-amber-700">
                            {formatearMonto(item.saldoPendiente)}
                          </td>
                        )}
                        <td className="py-2 px-3 text-center">
                          <Link
                            href={`/dashboard/fam/expedientes/${item.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#3258CA] bg-blue-50 border border-blue-200 rounded hover:bg-[#3258CA] hover:text-white transition-colors"
                          >
                            Ver Exp.
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {itemsFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No se encontraron expedientes con los criterios ingresados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal con botones de acción */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFiltrarEnTablaPrincipal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2846a3] transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtrar estos expedientes en la tabla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

