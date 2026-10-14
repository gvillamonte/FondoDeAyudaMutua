'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

const ESTADOS = ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'PAGADA'];
const FORMAS_PAGO = ['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'];

const INPUT_CLS = 'w-full px-3 py-2 border border-border-main rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30';

interface FormEstado {
  estado: string;
  monto: string;
  fechaSolicitud: string;
  fechaPago: string;
  observaciones: string;
  formaPago: string;
  banco: string;
  cartaNumero: string;
  cartaFecha: string;
  memorandoNumero: string;
  memorandoFecha: string;
  expedienteNumero: string;
}

const FORM_VACIO: FormEstado = {
  estado: '', monto: '', fechaSolicitud: '', fechaPago: '',
  observaciones: '', formaPago: '', banco: '',
  cartaNumero: '', cartaFecha: '', memorandoNumero: '', memorandoFecha: '',
  expedienteNumero: '',
};

const aFecha = (v: string | null | undefined) =>
  v ? new Date(v).toISOString().slice(0, 10) : '';

export default function EditarExpedienteModal({
  expedienteId,
  onClose,
  onSaved,
}: {
  expedienteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormEstado>(FORM_VACIO);
  const [encabezado, setEncabezado] = useState<{ tipo: string; numero: string }>({ tipo: '', numero: '' });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    api.get(`/fam-beneficios/${expedienteId}`)
      .then(({ data }) => {
        if (!activo) return;
        setForm({
          estado: data.estado || '',
          monto: String(data.monto ?? ''),
          fechaSolicitud: aFecha(data.fechaSolicitud),
          fechaPago: aFecha(data.fechaPago),
          observaciones: data.observaciones || '',
          formaPago: data.formaPago || '',
          banco: data.banco || '',
          cartaNumero: data.cartaNumero || '',
          cartaFecha: aFecha(data.cartaFecha),
          memorandoNumero: data.memorandoNumero || '',
          memorandoFecha: aFecha(data.memorandoFecha),
          expedienteNumero: data.expedienteNumero || '',
        });
        setEncabezado({
          tipo: data.tipoBeneficio?.nombre || '',
          numero: data.expedienteNumero || '',
        });
      })
      .catch(() => { if (activo) setError('No se pudo cargar el expediente.'); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [expedienteId]);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await api.put(`/fam-beneficios/${expedienteId}`, {
        estado: form.estado || undefined,
        monto: form.monto ? parseFloat(form.monto) : undefined,
        fechaSolicitud: form.fechaSolicitud || undefined,
        fechaPago: form.fechaPago || undefined,
        observaciones: form.observaciones || undefined,
        formaPago: form.formaPago || undefined,
        banco: form.banco || undefined,
        cartaNumero: form.cartaNumero || undefined,
        cartaFecha: form.cartaFecha || undefined,
        memorandoNumero: form.memorandoNumero || undefined,
        memorandoFecha: form.memorandoFecha || undefined,
        expedienteNumero: form.expedienteNumero || undefined,
      });
      showConfirmMessage('success', 'Beneficio actualizado correctamente', encabezado.numero || encabezado.tipo);
      onSaved();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Error al guardar';
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[700px] max-h-[90vh] flex flex-col border border-border-main">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-main">
          <div>
            <h3 className="text-lg font-semibold text-text-main">Editar beneficio del historial</h3>
            <p className="text-xs text-text-sec mt-0.5">
              {[encabezado.tipo, encabezado.numero && `N.° ${encabezado.numero}`].filter(Boolean).join(' · ') || 'Cargando...'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" title="Cerrar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-text-sec text-sm">
              <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Cargando expediente...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Estado</label>
                  <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={INPUT_CLS}>
                    {ESTADOS.map((e) => <option key={e} value={e}>{e === 'EN_REVISION' ? 'EN REVISIÓN' : e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Monto (S/) *</label>
                  <input type="number" min={0} step={0.01} value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° Expediente</label>
                  <input value={form.expedienteNumero}
                    onChange={(e) => setForm({ ...form, expedienteNumero: e.target.value })} className={INPUT_CLS} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Recepción</label>
                  <input type="date" value={form.fechaSolicitud}
                    onChange={(e) => setForm({ ...form, fechaSolicitud: e.target.value })} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">F. Pago</label>
                  <input type="date" value={form.fechaPago}
                    onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} className={INPUT_CLS} />
                </div>
              </div>

              <div className="border-t border-border-main pt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° de Carta</label>
                  <input value={form.cartaNumero} onChange={(e) => setForm({ ...form, cartaNumero: e.target.value })} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Carta</label>
                  <input type="date" value={form.cartaFecha} onChange={(e) => setForm({ ...form, cartaFecha: e.target.value })} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° Memorándum</label>
                  <input value={form.memorandoNumero} onChange={(e) => setForm({ ...form, memorandoNumero: e.target.value })} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Memorándum</label>
                  <input type="date" value={form.memorandoFecha} onChange={(e) => setForm({ ...form, memorandoFecha: e.target.value })} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Forma de Pago</label>
                  <select value={form.formaPago} onChange={(e) => setForm({ ...form, formaPago: e.target.value })} className={INPUT_CLS}>
                    <option value="">--</option>
                    {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Banco</label>
                  <input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className={INPUT_CLS} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  rows={3} className={INPUT_CLS} />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-border-main flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {guardando ? 'Guardando...' : 'Actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
