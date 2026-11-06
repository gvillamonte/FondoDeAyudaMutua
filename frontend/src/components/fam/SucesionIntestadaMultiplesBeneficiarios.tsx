'use client';

import { useState, useId } from 'react';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import {
  generarDeclaracionJuradaPdf,
  generarVoucherOrdenPagoPdf,
  DatosColegiadoPdf,
} from '@/lib/pdf-generator';

export interface HerederoForm {
  key: string;
  tipoDocumento: 'DNI' | 'CE' | 'PASAPORTE';
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
  porcentaje: number;
  monto: number;
  telefono?: string;
  email?: string;
  declaracionJuradaPdf?: string;
  declaracionSize?: number;
  ordenPagoPdf?: string;
  ordenPagoSize?: number;
}

const PARENTESCO_OPCIONES = [
  'Hijo(a)',
  'Cónyuge',
  'Conviviente',
  'Madre',
  'Padre',
  'Hermano(a)',
  'Sobrino(a)',
  'Tío(a)',
  'Nieto(a)',
  'Otro',
];

const MAX_PDF_MB = 10;

interface Props {
  montoTotal: number;
  colegiado?: DatosColegiadoPdf | null;
  expedienteNumero?: string;
  herederos: HerederoForm[];
  onChangeHerederos: (herederos: HerederoForm[]) => void;
  sucesionPdf: { base64: string; size: number } | null;
  onChangeSucesionPdf: (pdf: { base64: string; size: number } | null) => void;
  numeroPartidaRegistral: string;
  onChangePartida: (val: string) => void;
  notariaJuzgado: string;
  onChangeNotaria: (val: string) => void;
  onAbrirPdf: (base64: string, titulo: string) => void;
  cuentaConSucesion?: boolean;
  onChangeCuentaConSucesion?: (val: boolean) => void;
  observacionSinSucesion?: string;
  onChangeObservacionSinSucesion?: (val: string) => void;
}

export default function SucesionIntestadaMultiplesBeneficiarios({
  montoTotal,
  colegiado,
  expedienteNumero,
  herederos,
  onChangeHerederos,
  sucesionPdf,
  onChangeSucesionPdf,
  numeroPartidaRegistral,
  onChangePartida,
  notariaJuzgado,
  onChangeNotaria,
  onAbrirPdf,
  cuentaConSucesion = true,
  onChangeCuentaConSucesion,
  observacionSinSucesion = '',
  onChangeObservacionSinSucesion,
}: Props) {
  const [modoEdicion, setModoEdicion] = useState<'porcentaje' | 'monto'>('porcentaje');
  const [mostrarModalResumen, setMostrarModalResumen] = useState(false);
  const sustentoInputId = useId();

  // Cálculos de saldo en tiempo real
  const sumaPorcentajes = Number(
    herederos.reduce((acc, h) => acc + (Number(h.porcentaje) || 0), 0).toFixed(2),
  );
  const sumaMontos = Number(
    herederos.reduce((acc, h) => acc + (Number(h.monto) || 0), 0).toFixed(2),
  );
  const porcentajeRestante = Number((100 - sumaPorcentajes).toFixed(2));
  const montoRestante = Number((montoTotal - sumaMontos).toFixed(2));
  const esCuadreExacto =
    Math.abs(sumaPorcentajes - 100) <= 0.05 && Math.abs(sumaMontos - montoTotal) <= 0.05;

  // Detección de documentos duplicados
  const duplicadosSet = new Set<string>();
  const docsContados: Record<string, number> = {};
  herederos.forEach((h) => {
    const doc = h.numeroDocumento.trim();
    if (doc) {
      const key = `${h.tipoDocumento}-${doc}`;
      docsContados[key] = (docsContados[key] || 0) + 1;
      if (docsContados[key] > 1) {
        duplicadosSet.add(key);
      }
    }
  });

  const handleSucesionFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Sucesión Intestada: formato inválido', 'Solo se permiten archivos PDF (.pdf)');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage(
        'error',
        'Sucesión Intestada: archivo demasiado grande',
        `Máximo permitido: ${MAX_PDF_MB}MB — Archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      onChangeSucesionPdf({ base64, size: file.size });
      showConfirmMessage(
        'success',
        'Sustento de Sucesión Intestada cargado correctamente',
        `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      );
    };
    reader.readAsDataURL(file);
  };

  const agregarHeredero = () => {
    if (herederos.length >= 20) {
      showConfirmMessage('error', 'Límite alcanzado', 'Se permite un máximo de 20 beneficiarios herederos.');
      return;
    }

    const pctSugerido = porcentajeRestante > 0 ? porcentajeRestante : 0;
    const montoSugerido = montoRestante > 0 ? montoRestante : 0;

    const nuevo: HerederoForm = {
      key: Math.random().toString(36).slice(2),
      tipoDocumento: 'DNI',
      numeroDocumento: '',
      nombres: '',
      apellidos: '',
      parentesco: 'Hijo(a)',
      porcentaje: pctSugerido,
      monto: montoSugerido,
      telefono: '',
      email: '',
    };
    onChangeHerederos([...herederos, nuevo]);
  };

  const eliminarHeredero = (key: string) => {
    if (herederos.length <= 1) {
      showConfirmMessage('error', 'Mínimo requerido', 'Debe mantenerse al menos 1 beneficiario en la sucesión.');
      return;
    }
    const filtrados = herederos.filter((h) => h.key !== key);
    onChangeHerederos(filtrados);
  };

  const actualizarHeredero = (key: string, cambios: Partial<HerederoForm>) => {
    const actualizados = herederos.map((h) => {
      if (h.key !== key) return h;

      const merged = { ...h, ...cambios };

      // Conversión automática bidireccional
      if (cambios.porcentaje !== undefined && modoEdicion === 'porcentaje') {
        const pct = Math.max(0, Math.min(100, Number(cambios.porcentaje) || 0));
        merged.porcentaje = pct;
        merged.monto = Number(((pct / 100) * montoTotal).toFixed(2));
      } else if (cambios.monto !== undefined && modoEdicion === 'monto') {
        const m = Math.max(0, Number(cambios.monto) || 0);
        merged.monto = m;
        merged.porcentaje = montoTotal > 0 ? Number(((m / montoTotal) * 100).toFixed(2)) : 0;
      }

      return merged;
    });
    onChangeHerederos(actualizados);
  };

  const repartirEquitativamente = () => {
    if (!herederos.length || montoTotal <= 0) return;
    const n = herederos.length;
    const basePct = Number((100 / n).toFixed(2));
    const baseMonto = Number((montoTotal / n).toFixed(2));

    const actualizados = herederos.map((h, idx) => {
      let nuevoPct = basePct;
      let nuevoMonto = baseMonto;

      // Ajuste de redondeo de centavos en el último heredero
      if (idx === n - 1) {
        const sumaPrevPct = basePct * (n - 1);
        const sumaPrevMonto = baseMonto * (n - 1);
        nuevoPct = Number((100 - sumaPrevPct).toFixed(2));
        nuevoMonto = Number((montoTotal - sumaPrevMonto).toFixed(2));
      }

      const updated = {
        ...h,
        porcentaje: nuevoPct,
        monto: nuevoMonto,
      };

      // Si tiene datos suficientes y colegiado, regenerar documentos con nuevos montos
      if (colegiado && h.nombres.trim() && h.numeroDocumento.trim()) {
        try {
          const dj = generarDeclaracionJuradaPdf({
            heredero: updated,
            colegiado,
            montoTotal,
            partidaRegistral: numeroPartidaRegistral || undefined,
            notariaJuzgado: notariaJuzgado || undefined,
          });
          updated.declaracionJuradaPdf = dj.base64;
          updated.declaracionSize = dj.size;

          const voucher = generarVoucherOrdenPagoPdf({
            heredero: updated,
            colegiado,
            expedienteNumero: expedienteNumero || undefined,
          });
          updated.ordenPagoPdf = voucher.base64;
          updated.ordenPagoSize = voucher.size;
        } catch {}
      }

      return updated;
    });

    onChangeHerederos(actualizados);
    showConfirmMessage(
      'success',
      'Monto repartido equitativamente',
      `${n} herederos al ${(100 / n).toFixed(2)}% cada uno. Documentos regenerados.`,
    );
  };

  const handleSubirPdfHeredero = (
    key: string,
    campo: 'declaracionJurada' | 'ordenPago',
    file: File,
  ) => {
    const label = campo === 'declaracionJurada' ? 'Declaración Jurada' : 'Voucher / Orden de Pago';
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', `${label}: formato inválido`, 'Solo se permiten archivos PDF (.pdf)');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage(
        'error',
        `${label}: archivo demasiado grande`,
        `Máximo permitido: ${MAX_PDF_MB}MB`,
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      actualizarHeredero(key, {
        ...(campo === 'declaracionJurada'
          ? { declaracionJuradaPdf: base64, declaracionSize: file.size }
          : { ordenPagoPdf: base64, ordenPagoSize: file.size }),
      });
      showConfirmMessage('success', `${label} cargado correctamente`, `${(file.size / 1024 / 1024).toFixed(2)} MB`);
    };
    reader.readAsDataURL(file);
  };

  const generarDjHeredero = (h: HerederoForm) => {
    if (!h.numeroDocumento.trim() || !h.nombres.trim() || !h.apellidos.trim()) {
      showConfirmMessage(
        'error',
        'Datos incompletos',
        'Ingrese documento, nombres y apellidos del heredero antes de generar la Declaración Jurada.',
      );
      return;
    }
    if (!colegiado) {
      showConfirmMessage('error', 'Colegiado no seleccionado', 'Debe seleccionar un colegiado válido.');
      return;
    }

    try {
      const dj = generarDeclaracionJuradaPdf({
        heredero: h,
        colegiado,
        montoTotal,
        partidaRegistral: numeroPartidaRegistral || undefined,
        notariaJuzgado: notariaJuzgado || undefined,
      });
      actualizarHeredero(h.key, {
        declaracionJuradaPdf: dj.base64,
        declaracionSize: dj.size,
      });
      showConfirmMessage(
        'success',
        'Declaración Jurada generada',
        `Para ${h.nombres} ${h.apellidos} por S/ ${h.monto.toFixed(2)} (${h.porcentaje.toFixed(2)}%)`,
      );
    } catch (err: any) {
      showConfirmMessage('error', 'Error al generar PDF', err?.message || 'Error desconocido');
    }
  };

  const generarVoucherHeredero = (h: HerederoForm) => {
    if (!h.numeroDocumento.trim() || !h.nombres.trim() || !h.apellidos.trim()) {
      showConfirmMessage(
        'error',
        'Datos incompletos',
        'Ingrese documento, nombres y apellidos del heredero antes de generar el Voucher.',
      );
      return;
    }
    if (!colegiado) {
      showConfirmMessage('error', 'Colegiado no seleccionado', 'Debe seleccionar un colegiado válido.');
      return;
    }

    try {
      const voucher = generarVoucherOrdenPagoPdf({
        heredero: h,
        colegiado,
        expedienteNumero: expedienteNumero || undefined,
      });
      actualizarHeredero(h.key, {
        ordenPagoPdf: voucher.base64,
        ordenPagoSize: voucher.size,
      });
      showConfirmMessage(
        'success',
        'Voucher / Orden de Pago generado',
        `Para ${h.nombres} ${h.apellidos} por S/ ${h.monto.toFixed(2)} (${h.porcentaje.toFixed(2)}%)`,
      );
    } catch (err: any) {
      showConfirmMessage('error', 'Error al generar Voucher', err?.message || 'Error desconocido');
    }
  };

  const generarTodosLosDocumentos = () => {
    if (!colegiado) {
      showConfirmMessage('error', 'Colegiado requerido', 'Seleccione un colegiado antes de generar los documentos.');
      return;
    }

    let generados = 0;
    const actualizados = herederos.map((h) => {
      if (!h.numeroDocumento.trim() || !h.nombres.trim() || !h.apellidos.trim()) return h;

      try {
        const dj = generarDeclaracionJuradaPdf({
          heredero: h,
          colegiado,
          montoTotal,
          partidaRegistral: numeroPartidaRegistral || undefined,
          notariaJuzgado: notariaJuzgado || undefined,
        });

        const voucher = generarVoucherOrdenPagoPdf({
          heredero: h,
          colegiado,
          expedienteNumero: expedienteNumero || undefined,
        });

        generados++;
        return {
          ...h,
          declaracionJuradaPdf: dj.base64,
          declaracionSize: dj.size,
          ordenPagoPdf: voucher.base64,
          ordenPagoSize: voucher.size,
        };
      } catch {
        return h;
      }
    });

    onChangeHerederos(actualizados);
    if (generados > 0) {
      showConfirmMessage(
        'success',
        'Documentos generados exitosamente',
        `Se generaron Declaración Jurada y Voucher para ${generados} heredero(s).`,
      );
    } else {
      showConfirmMessage(
        'error',
        'No se generaron documentos',
        'Asegúrese de que los herederos tengan documento, nombres y apellidos completos.',
      );
    }
  };

  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 sm:p-5 space-y-5">
      {/* Cabecera Informativa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#3258CA]">
              Sucesión Intestada (Múltiples Beneficiarios)
            </span>
            <span className="text-xs text-text-sec">
              (El colegiado no tiene beneficiarios registrados en el padrón)
            </span>
          </div>
          <h4 className="text-sm font-bold text-text-main mt-1">
            Registro, Declaraciones Juradas y Vouchers de Herederos Legales
          </h4>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={generarTodosLosDocumentos}
            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803d] rounded-lg transition-colors shadow-sm flex items-center gap-1"
            title="Generar automáticamente Declaración Jurada y Voucher para todos los herederos completos"
          >
            ⚡ Generar todos los documentos
          </button>
          <button
            type="button"
            onClick={repartirEquitativamente}
            className="px-2.5 py-1 text-xs font-medium text-[#3258CA] bg-white border border-[#3258CA]/40 rounded-lg hover:bg-blue-50 transition-colors"
            title="Dividir en partes iguales con ajuste de centavos"
          >
            ⚖️ Repartir equitativamente
          </button>
          <button
            type="button"
            onClick={() => setMostrarModalResumen(true)}
            className="px-2.5 py-1 text-xs font-medium text-white bg-[#3258CA] rounded-lg hover:bg-[#25439b] transition-colors"
          >
            📋 Ver Resumen
          </button>
        </div>
      </div>

      {/* 1. Sustento de Sucesión Intestada (o Justificación de no presentación) */}
      <div className="bg-white border border-border rounded-lg p-3.5 space-y-3">
        {/* Selector: ¿Cuenta con sucesión intestada? */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
          <div>
            <label className="text-xs font-bold text-text-main uppercase tracking-wider block">
              1. Documento de Sustento de Sucesión Intestada
            </label>
            <span className="text-[11px] text-text-sec">
              Indique si cuenta con la resolución notarial/judicial o declare las observaciones correspondientes.
            </span>
          </div>

          <div className="inline-flex rounded-lg border border-border p-0.5 bg-slate-100 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                if (onChangeCuentaConSucesion) onChangeCuentaConSucesion(true);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                cuentaConSucesion !== false
                  ? 'bg-white text-[#3258CA] font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✓ Sí cuenta con Sucesión
            </button>
            <button
              type="button"
              onClick={() => {
                if (onChangeCuentaConSucesion) onChangeCuentaConSucesion(false);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                cuentaConSucesion === false
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚠️ No cuenta con Sucesión
            </button>
          </div>
        </div>

        {cuentaConSucesion !== false ? (
          /* CASO A: Cuenta con Sucesión Intestada (Sube el PDF) */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-text-primary block">
                Carga del documento PDF de Sucesión Intestada <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] text-text-sec">
                Adjunte el documento emitido por la Notaría o Juzgado (máx. {MAX_PDF_MB}MB).
              </span>
            </div>

            <div>
              {sucesionPdf ? (
                <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                  <span className="text-xs font-medium text-green-800">
                    ✓ Sustento cargado ({(sucesionPdf.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => onAbrirPdf(sucesionPdf.base64, 'Sustento de Sucesión Intestada')}
                    className="text-xs font-semibold text-[#3258CA] hover:underline"
                  >
                    Ver PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSucesionPdf(null)}
                    className="text-xs text-red-600 hover:text-red-800 ml-1 font-bold"
                    title="Eliminar archivo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label
                  htmlFor={sustentoInputId}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#3258CA] hover:bg-[#25439b] rounded-lg transition-colors shadow-sm"
                >
                  📄 Subir Sustento Legal (PDF)
                  <input
                    id={sustentoInputId}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleSucesionFile(e.target.files[0]);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        ) : (
          /* CASO B: NO cuenta con Sucesión Intestada (Observaciones obligatorias para justificar y permitir guardar) */
          <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3.5 space-y-2 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Observaciones: ¿Por qué no se está cargando la Sucesión Intestada? <span className="text-red-600">*</span>
              </label>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 inline-block w-fit">
                Permite guardar sin PDF
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              El colegiado no cuenta con sucesión intestada o se encuentra en trámite. Escriba las observaciones y justificación para que quede registrado en el expediente y el sistema le permita guardar:
            </p>
            <textarea
              rows={3}
              value={observacionSinSucesion || ''}
              onChange={(e) => {
                if (onChangeObservacionSinSucesion) onChangeObservacionSinSucesion(e.target.value);
              }}
              placeholder="Escriba aquí el porqué no se está cargando la sucesión intestada (ej: trámite notarial en curso, herederos en proceso de declaratoria judicial, beneficio asistencial urgente)..."
              className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-slate-800 placeholder-slate-400 shadow-inner"
            />
          </div>
        )}

        {/* Datos notariales del trámite */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-[11px] font-medium text-text-sec uppercase mb-1">
              Nº de Partida Registral / Expediente (Opcional)
            </label>
            <input
              type="text"
              value={numeroPartidaRegistral}
              onChange={(e) => onChangePartida(e.target.value)}
              placeholder="Ej. Partida Nº 11223344 (SUNARP)"
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-sec uppercase mb-1">
              Notaría o Juzgado de Emisión (Opcional)
            </label>
            <input
              type="text"
              value={notariaJuzgado}
              onChange={(e) => onChangeNotaria(e.target.value)}
              placeholder="Ej. Notaría Albarracín - Cusco"
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 2. Barra de Control de Reparto y Saldo en Tiempo Real */}
      <div className="bg-white border border-border rounded-lg p-3.5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-main uppercase">Modo de Asignación:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-gray-100">
              <button
                type="button"
                onClick={() => setModoEdicion('porcentaje')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  modoEdicion === 'porcentaje'
                    ? 'bg-white text-[#3258CA] shadow-sm font-semibold'
                    : 'text-text-sec hover:text-text-main'
                }`}
              >
                Porcentaje (%)
              </button>
              <button
                type="button"
                onClick={() => setModoEdicion('monto')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  modoEdicion === 'monto'
                    ? 'bg-white text-[#3258CA] shadow-sm font-semibold'
                    : 'text-text-sec hover:text-text-main'
                }`}
              >
                Monto Fijo (S/.)
              </button>
            </div>
          </div>

          <div className="text-xs text-text-main font-semibold">
            Monto Total a Repartir: <span className="text-[#3258CA] text-sm font-bold">S/ {montoTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Indicador Semántico de Balance */}
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border ${
            esCuadreExacto
              ? 'bg-green-50 border-green-300 text-green-800'
              : sumaPorcentajes > 100 || sumaMontos > montoTotal
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-amber-50 border-amber-300 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>
              {esCuadreExacto ? '✓' : sumaPorcentajes > 100 ? '⛔' : '⚠️'}
            </span>
            <span>
              {esCuadreExacto
                ? `Distribución completa: 100.00% asignado (S/ ${montoTotal.toFixed(2)})`
                : sumaPorcentajes > 100
                ? `Exceso en la asignación: +${(sumaPorcentajes - 100).toFixed(2)}% (+S/ ${(sumaMontos - montoTotal).toFixed(2)})`
                : `Pendiente por asignar: ${porcentajeRestante.toFixed(2)}% (S/ ${montoRestante.toFixed(2)})`}
            </span>
          </div>

          <div className="text-[11px] font-mono">
            Asignado: {sumaPorcentajes.toFixed(2)}% / S/ {sumaMontos.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 3. Lista Dinámica de Beneficiarios Herederos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-main uppercase tracking-wider">
            2. Lista de Herederos y Documentos Individuales ({herederos.length} de 20) *
          </label>
          <span className="text-[11px] text-text-sec">
            Cada beneficiario requiere Declaración Jurada y Voucher individual
          </span>
        </div>

        {herederos.map((h, idx) => {
          const docKey = `${h.tipoDocumento}-${h.numeroDocumento.trim()}`;
          const esDuplicado = h.numeroDocumento.trim() !== '' && duplicadosSet.has(docKey);
          const tieneDj = Boolean(h.declaracionJuradaPdf);
          const tieneVoucher = Boolean(h.ordenPagoPdf);

          return (
            <div
              key={h.key}
              className={`bg-white border rounded-xl p-3 sm:p-4 space-y-3 transition-colors ${
                esDuplicado
                  ? 'border-red-400 bg-red-50/20 shadow-sm'
                  : 'border-border hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-[#3258CA] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[11px]">
                    {idx + 1}
                  </span>
                  Heredero Legal #{idx + 1}: {h.nombres && h.apellidos ? `${h.nombres} ${h.apellidos}` : 'Nuevo'}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    S/ {h.monto.toFixed(2)} ({h.porcentaje.toFixed(2)}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminarHeredero(h.key)}
                    disabled={herederos.length <= 1}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 hover:bg-red-50"
                    title="Eliminar este heredero"
                  >
                    🗑️ Quitar
                  </button>
                </div>
              </div>

              {esDuplicado && (
                <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                  ⚠️ El documento <strong>{h.tipoDocumento} {h.numeroDocumento}</strong> está duplicado en la lista.
                </div>
              )}

              {/* Fila 1: Documento, Nombres y Apellidos, Parentesco */}
              <div className="grid grid-cols-12 gap-2 sm:gap-3">
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Tipo Doc *
                  </label>
                  <select
                    value={h.tipoDocumento}
                    onChange={(e) =>
                      actualizarHeredero(h.key, {
                        tipoDocumento: e.target.value as 'DNI' | 'CE' | 'PASAPORTE',
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="DNI">DNI (8 dígitos)</option>
                    <option value="CE">Carné de Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Nº Documento *
                  </label>
                  <input
                    type="text"
                    maxLength={h.tipoDocumento === 'DNI' ? 8 : 15}
                    value={h.numeroDocumento}
                    onChange={(e) =>
                      actualizarHeredero(h.key, {
                        numeroDocumento: e.target.value.replace(/[^a-zA-Z0-9]/g, ''),
                      })
                    }
                    placeholder={h.tipoDocumento === 'DNI' ? '8 dígitos' : 'Nº Documento'}
                    className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary ${
                      esDuplicado ? 'border-red-400 bg-red-50' : 'border-border'
                    }`}
                  />
                </div>

                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Nombres *
                  </label>
                  <input
                    type="text"
                    value={h.nombres}
                    onChange={(e) => actualizarHeredero(h.key, { nombres: e.target.value })}
                    placeholder="Nombres completos"
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    value={h.apellidos}
                    onChange={(e) => actualizarHeredero(h.key, { apellidos: e.target.value })}
                    placeholder="Apellidos completos"
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Fila 2: Parentesco, Porcentaje, Monto, Teléfono, Correo */}
              <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end">
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Parentesco *
                  </label>
                  <select
                    value={h.parentesco}
                    onChange={(e) => actualizarHeredero(h.key, { parentesco: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {PARENTESCO_OPCIONES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    % Asignado *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={h.porcentaje || ''}
                      onChange={(e) =>
                        actualizarHeredero(h.key, { porcentaje: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full pr-6 pl-2 py-1.5 text-xs font-mono font-semibold border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-text-sec">%</span>
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Monto (S/.) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={h.monto || ''}
                      onChange={(e) =>
                        actualizarHeredero(h.key, { monto: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full pr-2 pl-6 py-1.5 text-xs font-mono font-semibold border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute left-1.5 top-1.5 text-[11px] text-text-sec">S/</span>
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Celular (Contacto)
                  </label>
                  <input
                    type="tel"
                    maxLength={12}
                    value={h.telefono || ''}
                    onChange={(e) => actualizarHeredero(h.key, { telefono: e.target.value })}
                    placeholder="9 dígitos"
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-[11px] font-medium text-text-sec uppercase mb-0.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={h.email || ''}
                    onChange={(e) => actualizarHeredero(h.key, { email: e.target.value })}
                    placeholder="ejemplo@correo.com"
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Fila 3: Acciones de Declaración Jurada y Voucher Individuales */}
              <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-2.5 rounded-lg">
                {/* Bloque Declaración Jurada */}
                <div className="flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-main uppercase flex items-center gap-1">
                      <span>📜</span> Declaración Jurada
                    </span>
                    {tieneDj ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                        ✓ Generada / Cargada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                        ⚠️ Requerida
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => generarDjHeredero(h)}
                      className="px-2 py-1 text-[11px] font-medium text-[#3258CA] bg-white border border-[#3258CA]/40 rounded hover:bg-blue-50 transition-colors"
                      title="Generar la declaración jurada oficial en PDF con los datos actuales"
                    >
                      {tieneDj ? '🔄 Regenerar DJ' : '⚡ Generar DJ Oficial'}
                    </button>

                    {tieneDj && (
                      <button
                        type="button"
                        onClick={() =>
                          onAbrirPdf(
                            h.declaracionJuradaPdf!,
                            `Declaración Jurada - ${h.nombres} ${h.apellidos}`,
                          )
                        }
                        className="px-2 py-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100 transition-colors"
                      >
                        📄 Ver DJ
                      </button>
                    )}

                    <label className="cursor-pointer px-2 py-1 text-[11px] font-medium text-text-sec bg-white border border-border rounded hover:text-text-main hover:bg-gray-50 transition-colors">
                      📁 {tieneDj ? 'Reemplazar' : 'Subir Firmada'}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleSubirPdfHeredero(h.key, 'declaracionJurada', e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Bloque Voucher / Orden de Pago */}
                <div className="flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-main uppercase flex items-center gap-1">
                      <span>🧾</span> Voucher / Orden de Pago
                    </span>
                    {tieneVoucher ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                        ✓ Voucher listo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-[#3258CA]">
                        Asignado: S/ {h.monto.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => generarVoucherHeredero(h)}
                      className="px-2 py-1 text-[11px] font-medium text-[#3258CA] bg-white border border-[#3258CA]/40 rounded hover:bg-blue-50 transition-colors"
                      title="Generar la orden de pago/voucher oficial en PDF"
                    >
                      {tieneVoucher ? '🔄 Regenerar Voucher' : '⚡ Generar Voucher'}
                    </button>

                    {tieneVoucher && (
                      <button
                        type="button"
                        onClick={() =>
                          onAbrirPdf(
                            h.ordenPagoPdf!,
                            `Voucher / Orden de Pago - ${h.nombres} ${h.apellidos}`,
                          )
                        }
                        className="px-2 py-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100 transition-colors"
                      >
                        📄 Ver Voucher
                      </button>
                    )}

                    <label className="cursor-pointer px-2 py-1 text-[11px] font-medium text-text-sec bg-white border border-border rounded hover:text-text-main hover:bg-gray-50 transition-colors">
                      📁 {tieneVoucher ? 'Reemplazar' : 'Subir Voucher'}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleSubirPdfHeredero(h.key, 'ordenPago', e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Botón para agregar nuevo heredero */}
        <div className="pt-2">
          <button
            type="button"
            onClick={agregarHeredero}
            className="w-full py-2.5 border-2 border-dashed border-[#3258CA]/40 hover:border-[#3258CA] text-[#3258CA] hover:bg-blue-50/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span>+</span> Agregar otro beneficiario heredero (hasta 20)
          </button>
        </div>
      </div>

      {/* Modal de Resumen y Confirmación */}
      {mostrarModalResumen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main">
                  Resumen de Distribución de Sucesión Intestada
                </h3>
                <p className="text-xs text-text-sec">
                  Verifique que la lista de herederos, declaraciones juradas y vouchers concuerden con el documento legal adjunto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalResumen(false)}
                className="text-text-sec hover:text-text-main text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-sec">Monto Total del Beneficio:</span>
                  <span className="font-bold text-text-main">S/ {montoTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-sec">Sustento Legal Adjunto:</span>
                  <span className="font-medium text-green-700">
                    {sucesionPdf
                      ? `✓ PDF cargado (${(sucesionPdf.size / 1024 / 1024).toFixed(2)} MB)`
                      : observacionSinSucesion?.trim()
                      ? '⚠️ Sin Sucesión (Justificado en observaciones)'
                      : '❌ No adjuntado (Requiere justificación)'}
                  </span>
                </div>
                {numeroPartidaRegistral && (
                  <div className="flex justify-between">
                    <span className="text-text-sec">Partida Registral:</span>
                    <span className="font-medium">{numeroPartidaRegistral}</span>
                  </div>
                )}
                {notariaJuzgado && (
                  <div className="flex justify-between">
                    <span className="text-text-sec">Notaría / Juzgado:</span>
                    <span className="font-medium">{notariaJuzgado}</span>
                  </div>
                )}
              </div>

              <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-text-sec font-semibold text-left">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Documento</th>
                    <th className="p-2">Nombre Completo</th>
                    <th className="p-2">Parentesco</th>
                    <th className="p-2 text-right">%</th>
                    <th className="p-2 text-right">Monto (S/.)</th>
                    <th className="p-2 text-center">DJ</th>
                    <th className="p-2 text-center">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {herederos.map((h, i) => (
                    <tr key={h.key} className="hover:bg-gray-50">
                      <td className="p-2 font-mono">{i + 1}</td>
                      <td className="p-2">
                        {h.tipoDocumento}: {h.numeroDocumento}
                      </td>
                      <td className="p-2 font-medium">
                        {h.nombres} {h.apellidos}
                      </td>
                      <td className="p-2">{h.parentesco}</td>
                      <td className="p-2 text-right font-mono">{h.porcentaje.toFixed(2)}%</td>
                      <td className="p-2 text-right font-mono font-semibold">
                        S/ {h.monto.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        {h.declaracionJuradaPdf ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-red-500 font-bold">✗</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {h.ordenPagoPdf ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-amber-500 font-medium">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50/50 font-bold border-t border-border">
                  <tr>
                    <td colSpan={4} className="p-2 text-right">
                      Totales:
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${
                        Math.abs(sumaPorcentajes - 100) <= 0.05 ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {sumaPorcentajes.toFixed(2)}%
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${
                        Math.abs(sumaMontos - montoTotal) <= 0.05 ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      S/ {sumaMontos.toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setMostrarModalResumen(false)}
                className="px-4 py-2 bg-[#3258CA] hover:bg-[#25439b] text-white text-xs font-semibold rounded-lg"
              >
                Cerrar y Continuar Edición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
