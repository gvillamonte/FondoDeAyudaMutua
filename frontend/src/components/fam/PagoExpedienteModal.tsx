'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import Drawer from '@/components/ui/Drawer';

interface BeneficiarioPago {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco?: string | null;
  porcentajeAsignado: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  expedienteId: string;
  monto: number;
  fechaPagoSugerida?: string | null;
  formaPagoSugerida?: string | null;
  bancoSugerido?: string | null;
  beneficiarios: BeneficiarioPago[];
  solicitanteNombre?: string | null;
  solicitanteDni?: string | null;
  conCartaPoder?: boolean;
  apoderadoNombre?: string | null;
  apoderadoDni?: string | null;
  apoderadoParentesco?: string | null;
  poderOtorganteDni?: string | null;
  poderChequeNumero?: string | null;
  poderMotivo?: string | null;
}

interface FilaPago {
  beneficiarioId?: string;
  nombre: string;
  dni: string;
  parentesco?: string;
  porcentaje: number;
  monto: number;
  banco: string;
  numeroCuenta: string;
  cci: string;
  conCartaPoder: boolean;
  apoderadoNombre: string;
  apoderadoDni: string;
  apoderadoParentesco: string;
  poderMotivo: string;
}

const FORMA_PAGO_OPTIONS = [
  { value: 'DEPOSITO', label: 'Depósito Bancario' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Interbancaria' },
  { value: 'EFECTIVO', label: 'Efectivo' },
];

const MAX_PDF_MB = 10;
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function PagoExpedienteModal({
  isOpen,
  onClose,
  onSaved,
  expedienteId,
  monto,
  fechaPagoSugerida,
  formaPagoSugerida,
  bancoSugerido,
  beneficiarios,
  solicitanteNombre,
  solicitanteDni,
  conCartaPoder,
  apoderadoNombre,
  apoderadoDni,
  apoderadoParentesco,
  poderOtorganteDni,
  poderChequeNumero,
  poderMotivo,
}: Props) {
  const [fechaPago, setFechaPago] = useState('');
  const [formaPago, setFormaPago] = useState('DEPOSITO');
  const [filas, setFilas] = useState<FilaPago[]>([]);
  const [comprobantes, setComprobantes] = useState<Record<string, { base64: string; size: number }>>({});
  const [cartasPoder, setCartasPoder] = useState<Record<string, { base64: string; size: number }>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const montos = useMemo(() => {
    const total = Math.round((Number(monto) + Number.EPSILON) * 100) / 100;
    let acumulado = 0;
    return filas.map((f, i) => {
      const esUltimo = i === filas.length - 1;
      const valor = esUltimo
        ? Math.round((total - acumulado) * 100) / 100
        : Math.round(((total * f.porcentaje) / 100 + Number.EPSILON) * 100) / 100;
      acumulado = Math.round((acumulado + valor) * 100) / 100;
      return valor;
    });
  }, [filas, monto]);

  useEffect(() => {
    if (!isOpen) return;
    setFechaPago(fechaPagoSugerida ? String(fechaPagoSugerida).slice(0, 10) : '');
    setFormaPago((formaPagoSugerida || (conCartaPoder ? 'CHEQUE' : 'DEPOSITO')).toUpperCase());
    setComprobantes({});
    setCartasPoder({});
    setError('');

    const tienePoderExp = Boolean(conCartaPoder && apoderadoNombre);
    const base: FilaPago[] = beneficiarios.length
      ? beneficiarios.map((b, idx) => {
          const coincideOtorgante =
            tienePoderExp &&
            ((poderOtorganteDni && b.dni === poderOtorganteDni) ||
              (!poderOtorganteDni && (beneficiarios.length === 1 || idx === 0)));
          return {
            beneficiarioId: b.id,
            nombre: b.nombre,
            dni: b.dni || '',
            parentesco: b.parentesco || undefined,
            porcentaje: Number(b.porcentajeAsignado),
            monto: 0,
            banco: bancoSugerido || '',
            numeroCuenta: coincideOtorgante ? (poderChequeNumero || '') : '',
            cci: '',
            conCartaPoder: coincideOtorgante,
            apoderadoNombre: coincideOtorgante ? (apoderadoNombre || '') : '',
            apoderadoDni: coincideOtorgante ? (apoderadoDni || '') : '',
            apoderadoParentesco: coincideOtorgante ? (apoderadoParentesco || 'Tercero Autorizado con Carta Poder') : 'Tercero Autorizado con Carta Poder',
            poderMotivo: coincideOtorgante ? (poderMotivo || '') : '',
          };
        })
      : [
          {
            beneficiarioId: undefined,
            nombre: solicitanteNombre || 'Solicitante / Titular',
            dni: solicitanteDni || '',
            porcentaje: 100,
            monto: 0,
            banco: bancoSugerido || '',
            numeroCuenta: tienePoderExp ? (poderChequeNumero || '') : '',
            cci: '',
            conCartaPoder: tienePoderExp,
            apoderadoNombre: tienePoderExp ? (apoderadoNombre || '') : '',
            apoderadoDni: tienePoderExp ? (apoderadoDni || '') : '',
            apoderadoParentesco: tienePoderExp ? (apoderadoParentesco || 'Tercero Autorizado con Carta Poder') : 'Tercero Autorizado con Carta Poder',
            poderMotivo: tienePoderExp ? (poderMotivo || '') : '',
          },
        ];
    setFilas(base);
  }, [
    isOpen,
    beneficiarios,
    fechaPagoSugerida,
    formaPagoSugerida,
    bancoSugerido,
    solicitanteNombre,
    solicitanteDni,
    conCartaPoder,
    apoderadoNombre,
    apoderadoDni,
    apoderadoParentesco,
    poderOtorganteDni,
    poderChequeNumero,
    poderMotivo,
  ]);

  const actualizar = (index: number, cambios: Partial<FilaPago>) => {
    setFilas((prev) => prev.map((f, i) => (i === index ? { ...f, ...cambios } : f)));
  };

  const subirComprobante = (fila: FilaPago, file: File) => {
    const key = fila.beneficiarioId || 'sucesion';
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', `Máximo ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setComprobantes((prev) => ({ ...prev, [key]: { base64, size: file.size } }));
      showConfirmMessage('success', 'Comprobante cargado', fila.nombre);
    };
    reader.readAsDataURL(file);
  };

  const subirCartaPoder = (fila: FilaPago, file: File) => {
    const key = fila.beneficiarioId || 'sucesion';
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', `Máximo ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setCartasPoder((prev) => ({ ...prev, [key]: { base64, size: file.size } }));
      showConfirmMessage('success', 'Carta Poder cargada', fila.nombre);
    };
    reader.readAsDataURL(file);
  };

  const registrar = async () => {
    if (!fechaPago) {
      setError('Indique la fecha de depósito / pago');
      return;
    }
    for (const f of filas) {
      if (formaPago !== 'EFECTIVO' && !f.banco.trim()) {
        setError(`Indique el banco para ${f.nombre}`);
        return;
      }
      if ((formaPago === 'DEPOSITO' || formaPago === 'TRANSFERENCIA') && !f.numeroCuenta.trim() && !f.cci.trim()) {
        setError(`Indique la cuenta o CCI del depósito de ${f.nombre}`);
        return;
      }
      if (f.conCartaPoder) {
        if (!f.apoderadoNombre.trim()) {
          setError(`Indique los nombres de quien cobrará con Carta Poder por ${f.nombre}`);
          return;
        }
        if (!/^\d{8}$/.test(f.apoderadoDni.trim())) {
          setError(`El DNI del apoderado que cobra por ${f.nombre} debe tener 8 dígitos`);
          return;
        }
      }
    }

    setGuardando(true);
    setError('');
    try {
      await api.post(`/fam-beneficios/${expedienteId}/pagar`, {
        fechaPago,
        formaPago,
        depositos: filas.map((f) => {
          const key = f.beneficiarioId || 'sucesion';
          return {
            ...(f.beneficiarioId ? { beneficiarioId: f.beneficiarioId } : {}),
            ...(f.nombre ? { nombreBeneficiario: f.nombre.trim() } : {}),
            ...(f.dni ? { dniBeneficiario: f.dni.trim() } : {}),
            banco: f.banco.trim() || undefined,
            numeroCuenta: f.numeroCuenta.trim() || undefined,
            cci: f.cci.trim() || undefined,
            ...(comprobantes[key]?.base64 && { comprobantePdf: comprobantes[key].base64 }),
            conCartaPoder: f.conCartaPoder,
            ...(f.conCartaPoder && {
              apoderadoNombre: f.apoderadoNombre.trim(),
              apoderadoDni: f.apoderadoDni.trim(),
              apoderadoParentesco: f.apoderadoParentesco.trim() || 'Apoderado',
              poderMotivo: f.poderMotivo.trim() || undefined,
              ...(cartasPoder[key]?.base64 && { cartaPoderPdf: cartasPoder[key].base64 }),
            }),
          };
        }),
      });
      showConfirmMessage('success', 'Pago registrado correctamente', `${filas.length} entrega(s) registrada(s)`);
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'No se pudo registrar el pago';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Registrar pago del expediente" width="sm:w-[52rem]">
      <div className="space-y-4">
        <p className="text-sm text-text-sec">
          Se generará un registro de entrega por cada beneficiario. Si el beneficiario (ej. Hijo) o el colegiado delega el cobro del cheque a otra persona mediante <strong>Carta Poder</strong>, actívelo en la fila correspondiente para dejar trazabilidad completa.
        </p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Fecha de depósito / pago *</label>
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Tipo de pago *</label>
            <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white">
              {FORMA_PAGO_OPTIONS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Monto total entregado</label>
            <div className="px-3 py-2 bg-gray-50 border border-border rounded-lg text-sm font-semibold text-text-main">{fmtMonto(Number(monto))}</div>
          </div>
        </div>

        <div className="space-y-3">
          {filas.map((f, i) => {
            const key = f.beneficiarioId || 'sucesion';
            return (
              <div key={`${key}-${i}`} className="border border-border rounded-lg p-3.5 bg-white space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text-main truncate">
                        Beneficiario: {f.nombre}
                      </p>
                      {f.parentesco && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-[#3258CA] border border-blue-200">
                          {f.parentesco}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-sec">DNI: {f.dni || '—'} · Participación: {f.porcentaje}%</p>
                  </div>
                  <p className="text-sm font-bold text-primary">{fmtMonto(montos[i] || 0)}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      Banco {formaPago !== 'EFECTIVO' ? '*' : ''}
                    </label>
                    <input value={f.banco} onChange={(e) => actualizar(i, { banco: e.target.value })}
                      placeholder="BCP, BBVA, Interbank, Banco de la Nación…" className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">
                      {formaPago === 'CHEQUE' ? 'N° Cheque / Operación' : 'N° cuenta'}
                    </label>
                    <input value={f.numeroCuenta} onChange={(e) => actualizar(i, { numeroCuenta: e.target.value })}
                      placeholder={formaPago === 'CHEQUE' ? 'N° de cheque' : 'N° de cuenta bancaria'}
                      className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">CCI</label>
                    <input value={f.cci} onChange={(e) => actualizar(i, { cci: e.target.value })}
                      className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                  </div>
                </div>

                {/* Toggle Carta Poder para el cobro de este beneficiario */}
                <div className="pt-1 border-t border-slate-100 space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.conCartaPoder}
                      onChange={(e) => actualizar(i, { conCartaPoder: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[#3258CA] rounded"
                    />
                    <span className="text-xs font-semibold text-amber-800">
                      📋 ¿Otorga Carta Poder a otra persona para cobrar el cheque / recibir el beneficio?
                    </span>
                  </label>

                  {f.conCartaPoder && (
                    <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-3 space-y-2">
                      <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                        Trazabilidad: {f.nombre} otorga poder de cobro a:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-900 uppercase mb-0.5">
                            Nombres del Apoderado (Quien cobra) *
                          </label>
                          <input
                            value={f.apoderadoNombre}
                            onChange={(e) => actualizar(i, { apoderadoNombre: e.target.value })}
                            placeholder="Nombre completo de quien cobra"
                            className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-900 uppercase mb-0.5">
                            DNI del Apoderado *
                          </label>
                          <input
                            maxLength={8}
                            value={f.apoderadoDni}
                            onChange={(e) => actualizar(i, { apoderadoDni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                            placeholder="8 dígitos"
                            className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs font-mono bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-900 uppercase mb-0.5">
                            Vínculo / Parentesco
                          </label>
                          <input
                            value={f.apoderadoParentesco}
                            onChange={(e) => actualizar(i, { apoderadoParentesco: e.target.value })}
                            placeholder="Ej. Tío(a), Madre, Apoderado Legal..."
                            className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-900 uppercase mb-0.5">
                            Motivo / Observación de Trazabilidad
                          </label>
                          <input
                            value={f.poderMotivo}
                            onChange={(e) => actualizar(i, { poderMotivo: e.target.value })}
                            placeholder="Ej. El hijo beneficiario delega el cobro del cheque mediante carta poder..."
                            className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-3">
                          <span className="text-[10px] font-semibold text-amber-900 uppercase">Carta Poder PDF:</span>
                          {cartasPoder[key] ? (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              ✓ {(cartasPoder[key].size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          ) : (
                            <span className="text-xs text-amber-800">Opcional</span>
                          )}
                          <label className="cursor-pointer text-xs font-semibold text-[#3258CA] hover:underline">
                            {cartasPoder[key] ? 'Reemplazar PDF' : 'Subir Carta Poder'}
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) subirCartaPoder(f, e.target.files[0]);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] font-semibold text-text-sec uppercase">Comprobante de Pago/Cheque</span>
                  {comprobantes[key] ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      {(comprobantes[key].size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  ) : (
                    <span className="text-xs text-text-sec">Opcional</span>
                  )}
                  <label className="cursor-pointer text-xs text-primary hover:underline">
                    {comprobantes[key] ? 'Reemplazar' : 'Subir PDF'}
                    <input type="file" accept="application/pdf,.pdf" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) subirComprobante(f, e.target.files[0]); }} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg text-text-main hover:bg-gray-50">Cancelar</button>
          <button onClick={registrar} disabled={guardando}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {guardando ? 'Registrando…' : `Registrar pago (${filas.length} depósito${filas.length === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
