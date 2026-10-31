'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import Drawer from '@/components/ui/Drawer';

interface BeneficiarioPago {
  id: string;
  nombre: string;
  dni: string | null;
  porcentajeAsignado: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  expedienteId: string;
  monto: number;
  bancoSugerido?: string | null;
  beneficiarios: BeneficiarioPago[];
  solicitanteNombre?: string | null;
  solicitanteDni?: string | null;
}

interface FilaPago {
  beneficiarioId?: string;
  nombre: string;
  dni: string;
  porcentaje: number;
  monto: number;
  banco: string;
  numeroCuenta: string;
  cci: string;
}

const MAX_PDF_MB = 10;
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function PagoExpedienteModal({
  isOpen,
  onClose,
  onSaved,
  expedienteId,
  monto,
  bancoSugerido,
  beneficiarios,
  solicitanteNombre,
  solicitanteDni,
}: Props) {
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [filas, setFilas] = useState<FilaPago[]>([]);
  const [comprobantes, setComprobantes] = useState<Record<string, { base64: string; size: number }>>({});
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
    setFechaPago(new Date().toISOString().slice(0, 10));
    setComprobantes({});
    setError('');
    const base = beneficiarios.length
      ? beneficiarios.map((b) => ({
          beneficiarioId: b.id,
          nombre: b.nombre,
          dni: b.dni || '',
          porcentaje: Number(b.porcentajeAsignado),
          monto: 0,
          banco: bancoSugerido || '',
          numeroCuenta: '',
          cci: '',
        }))
      : [{
          beneficiarioId: undefined,
          nombre: solicitanteNombre || 'Solicitante (Sucesión Intestada)',
          dni: solicitanteDni || '',
          porcentaje: 100,
          monto: 0,
          banco: bancoSugerido || '',
          numeroCuenta: '',
          cci: '',
        }];
    setFilas(base);
  }, [isOpen, beneficiarios, bancoSugerido, solicitanteNombre, solicitanteDni]);

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

  const registrar = async () => {
    if (!fechaPago) {
      setError('Indique la fecha de pago');
      return;
    }
    for (const f of filas) {
      if (!f.banco.trim()) {
        setError(`Indique el banco del depósito de ${f.nombre}`);
        return;
      }
      if (!f.numeroCuenta.trim() && !f.cci.trim()) {
        setError(`Indique la cuenta o CCI del depósito de ${f.nombre}`);
        return;
      }
    }

    setGuardando(true);
    setError('');
    try {
      await api.post(`/fam-beneficios/${expedienteId}/pagar`, {
        fechaPago,
        depositos: filas.map((f) => {
          const key = f.beneficiarioId || 'sucesion';
          return {
            ...(f.beneficiarioId ? { beneficiarioId: f.beneficiarioId } : {}),
            banco: f.banco.trim() || undefined,
            numeroCuenta: f.numeroCuenta.trim() || undefined,
            cci: f.cci.trim() || undefined,
            ...(comprobantes[key]?.base64 && { comprobantePdf: comprobantes[key].base64 }),
          };
        }),
      });
      showConfirmMessage('success', 'Pago registrado correctamente', `${filas.length} depósito(s) generado(s)`);
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
    <Drawer isOpen={isOpen} onClose={onClose} title="Registrar pago del expediente" width="sm:w-[50rem]">
      <div className="space-y-4">
        <p className="text-sm text-text-sec">
          Se generará un depósito por cada beneficiario, todos con la misma fecha de pago y el monto según su porcentaje.
        </p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Fecha de pago *</label>
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Monto total del expediente</label>
            <div className="px-3 py-2 bg-gray-50 border border-border rounded-lg text-sm font-semibold text-text-main">{fmtMonto(Number(monto))}</div>
          </div>
        </div>

        <div className="space-y-3">
          {filas.map((f, i) => (
            <div key={`${f.beneficiarioId || 'sucesion'}-${i}`} className="border border-border rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-main truncate">{f.nombre}</p>
                  <p className="text-xs text-text-sec">DNI: {f.dni || '—'} · {f.porcentaje}%</p>
                </div>
                <p className="text-sm font-bold text-primary">{fmtMonto(montos[i] || 0)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">Banco *</label>
                  <input value={f.banco} onChange={(e) => actualizar(i, { banco: e.target.value })}
                    placeholder="BCP, Interbank…" className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">N° cuenta</label>
                  <input value={f.numeroCuenta} onChange={(e) => actualizar(i, { numeroCuenta: e.target.value })}
                    className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">CCI</label>
                  <input value={f.cci} onChange={(e) => actualizar(i, { cci: e.target.value })}
                    className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-text-sec uppercase">Comprobante</span>
                {comprobantes[f.beneficiarioId || 'sucesion'] ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    {(comprobantes[f.beneficiarioId || 'sucesion'].size / 1024 / 1024).toFixed(2)} MB
                  </span>
                ) : (
                  <span className="text-xs text-text-sec">Opcional</span>
                )}
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  {comprobantes[f.beneficiarioId || 'sucesion'] ? 'Reemplazar' : 'Subir PDF'}
                  <input type="file" accept="application/pdf,.pdf" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) subirComprobante(f, e.target.files[0]); }} />
                </label>
              </div>
            </div>
          ))}
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
