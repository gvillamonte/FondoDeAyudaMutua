'use client';

import React from 'react';

export interface BeneficiarioPrevioItem {
  id?: string;
  nombre: string;
  dni?: string | null;
  parentesco?: string;
  porcentajeAsignado?: number;
  porcentaje?: number;
  monto?: number;
  origen?: string;
}

export interface ExpedientePrevioInfo {
  id?: string | null;
  expedienteNumero?: string | null;
  estado?: string | null;
  tipoBeneficio?: { nombre?: string } | null;
  fechaDefuncion?: string | null;
  causaFallecimiento?: string | null;
  fechaSolicitud?: string | null;
  monto?: number | null;
  solicitanteNombre?: string | null;
  solicitanteDni?: string | null;
  depositos?: Array<{
    id?: string;
    nombreBeneficiario?: string;
    dniBeneficiario?: string;
    porcentaje?: number;
    monto?: number;
    banco?: string;
    numeroCuenta?: string;
    cci?: string;
    fechaPago?: string;
  }>;
}

interface ModalBeneficiariosFallecidoProps {
  isOpen: boolean;
  onClose: () => void;
  colegiado: {
    NUM_COLEGIATURA?: string;
    NOMBRE_COLEGIADO?: string;
    DNI?: string | null;
    ESTADO?: string;
  } | null;
  expedientePrevio?: ExpedientePrevioInfo | null;
  beneficiarios: BeneficiarioPrevioItem[];
  onCargarBeneficiarios?: (bens: BeneficiarioPrevioItem[]) => void;
}

export default function ModalBeneficiariosFallecido({
  isOpen,
  onClose,
  colegiado,
  expedientePrevio,
  beneficiarios = [],
  onCargarBeneficiarios,
}: ModalBeneficiariosFallecidoProps) {
  if (!isOpen) return null;

  const totalPorcentaje = beneficiarios.reduce(
    (acc, b) => acc + Number(b.porcentajeAsignado ?? b.porcentaje ?? 0),
    0
  );

  const formatFecha = (f?: string | null) => {
    if (!f) return '-';
    try {
      const d = new Date(f);
      return isNaN(d.getTime()) ? String(f).slice(0, 10) : d.toLocaleDateString('es-PE');
    } catch {
      return String(f).slice(0, 10);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
              ⚠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-main">
                  Beneficiarios Registrados - Colegiado Fallecido
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                  FALLECIDO
                </span>
              </div>
              <p className="text-xs text-text-sec mt-0.5">
                Consulta de beneficiarios asociados al expediente previo o padrón maestro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-text-main p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            title="Cerrar modal"
          >
            <svg className="w-5 h-5" width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Ficha Resumen del Colegiado */}
          <div className="bg-[#F8FAFC] border border-border rounded-lg p-3.5 text-xs text-text-main">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-text-sec block text-[11px]">Colegiado:</span>
                <span className="font-semibold text-primary">{colegiado?.NUM_COLEGIATURA || '-'}</span>
                <span className="ml-1.5 font-medium">{colegiado?.NOMBRE_COLEGIADO || '-'}</span>
              </div>
              <div>
                <span className="text-text-sec block text-[11px]">DNI Colegiado:</span>
                <span className="font-medium">{colegiado?.DNI || 'S/D'}</span>
              </div>
              <div>
                <span className="text-text-sec block text-[11px]">Estado Institucional:</span>
                <span className="font-semibold text-red-700">{colegiado?.ESTADO || 'FALLECIDO'}</span>
              </div>
            </div>

            {expedientePrevio && (
              <div className="mt-2.5 pt-2.5 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {expedientePrevio.expedienteNumero && (
                  <div>
                    <span className="text-text-sec block">N.° Expediente Previo:</span>
                    <span className="font-semibold text-text-main">{expedientePrevio.expedienteNumero}</span>
                  </div>
                )}
                {expedientePrevio.fechaDefuncion && (
                  <div>
                    <span className="text-text-sec block">Fecha de Defunción:</span>
                    <span className="font-medium">{formatFecha(expedientePrevio.fechaDefuncion)}</span>
                  </div>
                )}
                {expedientePrevio.estado && (
                  <div>
                    <span className="text-text-sec block">Estado del Trámite:</span>
                    <span className="font-medium text-amber-700">{expedientePrevio.estado}</span>
                  </div>
                )}
                {expedientePrevio.monto != null && Number(expedientePrevio.monto) > 0 && (
                  <div>
                    <span className="text-text-sec block">Monto Previo:</span>
                    <span className="font-semibold text-green-700">S/ {Number(expedientePrevio.monto).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabla de Beneficiarios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                <span>Lista de Beneficiarios ({beneficiarios.length})</span>
                {totalPorcentaje > 0 && (
                  <span className="text-[11px] font-medium text-text-sec">
                    (Total asignado: {totalPorcentaje.toFixed(2)}%)
                  </span>
                )}
              </h4>
            </div>

            {beneficiarios.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 border border-dashed border-border rounded-lg text-text-sec text-xs">
                <span className="text-2xl block mb-1">📋</span>
                No hay beneficiarios registrados en el expediente previo ni en el padrón para este colegiado.
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-border">
                    <tr className="text-left text-text-sec font-semibold">
                      <th className="px-3 py-2 w-10 text-center">#</th>
                      <th className="px-3 py-2">Beneficiario</th>
                      <th className="px-3 py-2">DNI</th>
                      <th className="px-3 py-2">Parentesco</th>
                      <th className="px-3 py-2 text-right">Porcentaje</th>
                      {beneficiarios.some((b) => (b.monto || 0) > 0) && (
                        <th className="px-3 py-2 text-right">Monto</th>
                      )}
                      <th className="px-3 py-2 text-center">Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {beneficiarios.map((b, idx) => {
                      const porc = Number(b.porcentajeAsignado ?? b.porcentaje ?? 0);
                      return (
                        <tr key={b.id || idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 text-center font-medium text-text-sec">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-text-main">{b.nombre}</td>
                          <td className="px-3 py-2 text-text-sec font-mono">{b.dni || '-'}</td>
                          <td className="px-3 py-2">
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-text-sec text-[11px]">
                              {b.parentesco || 'Familiar'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-text-main">
                            {porc > 0 ? `${porc.toFixed(2)}%` : '-'}
                          </td>
                          {beneficiarios.some((item) => (item.monto || 0) > 0) && (
                            <td className="px-3 py-2 text-right font-semibold text-green-700">
                              {(b.monto || 0) > 0 ? `S/ ${Number(b.monto).toFixed(2)}` : '-'}
                            </td>
                          )}
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-red-50 text-[#8f0404] border border-red-200">
                              {b.origen || 'Previo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Depósitos o Pagos Previos si existen */}
          {expedientePrevio?.depositos && expedientePrevio.depositos.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-text-main uppercase tracking-wider mb-2">
                Depósitos / Pagos Registrados ({expedientePrevio.depositos.length})
              </h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-border">
                    <tr className="text-left text-text-sec font-semibold">
                      <th className="px-3 py-2">Beneficiario</th>
                      <th className="px-3 py-2">Banco</th>
                      <th className="px-3 py-2">N.° Cuenta / CCI</th>
                      <th className="px-3 py-2 text-right">Monto Pagado</th>
                      <th className="px-3 py-2 text-center">Fecha Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expedientePrevio.depositos.map((dep, idx) => (
                      <tr key={dep.id || idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-text-main">
                          {dep.nombreBeneficiario || '-'}
                          {dep.dniBeneficiario && (
                            <span className="text-[11px] text-text-sec block font-mono">DNI: {dep.dniBeneficiario}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-sec">{dep.banco || '-'}</td>
                        <td className="px-3 py-2 text-text-sec font-mono text-[11px]">
                          {dep.numeroCuenta || dep.cci || '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">
                          S/ {Number(dep.monto || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center text-text-sec text-[11px]">
                          {formatFecha(dep.fechaPago)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-[#F8FAFC] flex items-center justify-between gap-3">
          <div className="text-[11px] text-amber-800 flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>Puede continuar registrando el expediente con estos u otros beneficiarios.</span>
          </div>
          <div className="flex items-center gap-2">
            {onCargarBeneficiarios && beneficiarios.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onCargarBeneficiarios(beneficiarios);
                  onClose();
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-primary bg-white border border-primary/40 rounded-lg hover:bg-primary hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span>📥 Cargar en este formulario</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

