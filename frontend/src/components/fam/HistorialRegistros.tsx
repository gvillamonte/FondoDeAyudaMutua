'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface TipoBeneficio {
  id: number;
  nombre: string;
  descripcion?: string;
}

interface SolicitudFAM {
  id: string;
  colegiadoId: string;
  tipoBeneficioId: string;
  monto: number;
  moneda: string;
  estado: string;
  fechaSolicitud: string;
  fechaResolucion: string | null;
  observaciones: string | null;
  cartaNumero: string | null;
  expedienteNumero: string | null;
  cartaFecha: string | null;
  memorandoNumero: string | null;
  memorandoFecha: string | null;
  formaPago: string | null;
  banco: string | null;
  ordenPagoFecha: string | null;
  tipoBeneficio?: TipoBeneficio;
}

interface BeneficiarioVinculado {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  EN_REVISION: 'bg-blue-100 text-blue-700',
  APROBADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
  PAGADA: 'bg-purple-100 text-purple-700',
};

const ESTADO_OPTIONS = ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'PAGADA'];
const FORMA_PAGO_OPTIONS = ['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'];

export default function HistorialRegistros() {
  const [solicitudes, setSolicitudes] = useState<SolicitudFAM[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState<TipoBeneficio[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [filterEstado, setFilterEstado] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudFAM | null>(null);
  const [vinculados, setVinculados] = useState<BeneficiarioVinculado[]>([]);

  const [form, setForm] = useState({
    tipoBeneficioId: '',
    monto: '',
    observaciones: '',
    cartaNumero: '',
    expedienteNumero: '',
    cartaFecha: '',
    memorandoNumero: '',
    memorandoFecha: '',
    formaPago: '',
    banco: '',
    ordenPagoFecha: '',
  });

  useEffect(() => {
    api.get('/tipos-beneficio-config', { params: { activos: 'true' } })
      .then(({ data }) => setTipos(Array.isArray(data) ? data : []))
      .catch(() => setTipos([]));
  }, []);

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (filterEstado) params.estado = filterEstado;
      const { data } = await api.get('/fam-beneficios', { params });
      setSolicitudes(Array.isArray(data?.data) ? data.data : []);
      setTotal(data?.meta?.total || 0);
    } catch { setSolicitudes([]); } finally { setLoading(false); }
  }, [page, limit, search, filterEstado]);

  useEffect(() => { fetchSolicitudes(); }, [fetchSolicitudes]);

  const openDetail = async (s: SolicitudFAM) => {
    setSelectedSolicitud(s);
    setVinculados([]);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/fam-beneficios/${s.id}`);
      setVinculados(Array.isArray(data?.beneficiariosVinculados) ? data.beneficiariosVinculados : []);
    } catch {} finally { setDetailLoading(false); }
  };

  const openForm = (s: SolicitudFAM) => {
    setEditingId(s.id);
    setForm({
      tipoBeneficioId: s.tipoBeneficioId || '',
      monto: String(s.monto),
      observaciones: s.observaciones || '',
      cartaNumero: s.cartaNumero || '',
      expedienteNumero: s.expedienteNumero || '',
      cartaFecha: s.cartaFecha ? s.cartaFecha.slice(0, 10) : '',
      memorandoNumero: s.memorandoNumero || '',
      memorandoFecha: s.memorandoFecha ? s.memorandoFecha.slice(0, 10) : '',
      formaPago: s.formaPago || '',
      banco: s.banco || '',
      ordenPagoFecha: s.ordenPagoFecha ? s.ordenPagoFecha.slice(0, 10) : '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    setFormSaving(true);
    setFormError('');
    try {
      await api.put(`/fam-beneficios/${editingId}`, {
        tipoBeneficioId: form.tipoBeneficioId || undefined,
        monto: parseFloat(form.monto) || undefined,
        observaciones: form.observaciones || undefined,
        cartaNumero: form.cartaNumero || undefined,
        expedienteNumero: form.expedienteNumero || undefined,
        cartaFecha: form.cartaFecha || undefined,
        memorandoNumero: form.memorandoNumero || undefined,
        memorandoFecha: form.memorandoFecha || undefined,
        formaPago: form.formaPago || undefined,
        banco: form.banco || undefined,
        ordenPagoFecha: form.ordenPagoFecha || undefined,
      });
      setFormOpen(false);
      fetchSolicitudes();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally { setFormSaving(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <input type="text" placeholder="Buscar por CIP..." value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            className="flex-1 max-w-md px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <select value={filterEstado} onChange={(e) => { setFilterEstado(e.target.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            {ESTADO_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button onClick={() => { setSearch(searchInput); setPage(1); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
            Buscar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Tipo Beneficio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Expediente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <svg className="animate-spin w-5 h-5 mx-auto text-text-sec" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </td></tr>
              ) : solicitudes.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-text-sec">No hay registros</td></tr>
              ) : (
                solicitudes.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-text-main">{s.tipoBeneficio?.nombre || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text-main font-semibold">S/ {Number(s.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ESTADO_COLORS[s.estado] || 'bg-gray-100 text-gray-700'}`}>{s.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-sec">{s.expedienteNumero || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text-sec">{new Date(s.fechaSolicitud).toLocaleDateString('es-PE')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openDetail(s)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Ver detalle">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button onClick={() => openForm(s)} className="p-1.5 rounded hover:bg-amber-50 text-amber-500" title="Editar datos administrativos">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-text-sec">Total: {total} registros</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50">Anterior</button>
              <span className="text-sm text-text-sec">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Editar */}
      {formOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[700px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-main">Editar Registro</h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Tipo de Beneficio *</label>
                  <select value={form.tipoBeneficioId} onChange={(e) => setForm({ ...form, tipoBeneficioId: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="">Seleccionar tipo</option>
                    {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Monto (S/) *</label>
                  <input type="number" min="0" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} />
              </div>
              <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° de Carta</label>
                  <input type="text" value={form.cartaNumero} onChange={(e) => setForm({ ...form, cartaNumero: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° de Expediente</label>
                  <input type="text" value={form.expedienteNumero} onChange={(e) => setForm({ ...form, expedienteNumero: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Carta</label>
                  <input type="date" value={form.cartaFecha} onChange={(e) => setForm({ ...form, cartaFecha: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° de Memorándum</label>
                  <input type="text" value={form.memorandoNumero} onChange={(e) => setForm({ ...form, memorandoNumero: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Memorándum</label>
                  <input type="date" value={form.memorandoFecha} onChange={(e) => setForm({ ...form, memorandoFecha: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Forma de Pago</label>
                  <select value={form.formaPago} onChange={(e) => setForm({ ...form, formaPago: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="">--</option>
                    {FORMA_PAGO_OPTIONS.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Banco</label>
                  <input type="text" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha Orden de Pago</label>
                  <input type="date" value={form.ordenPagoFecha} onChange={(e) => setForm({ ...form, ordenPagoFecha: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSave} disabled={formSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {formSaving ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle con vinculados */}
      {detailOpen && selectedSolicitud && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-main">Detalle del Registro</h3>
              <button onClick={() => setDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Información General</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Tipo de Beneficio</span><span className="text-sm font-medium text-text-main">{selectedSolicitud.tipoBeneficio?.nombre || selectedSolicitud.tipoBeneficioId}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Monto</span><span className="text-sm font-bold text-green-600">S/ {Number(selectedSolicitud.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Estado</span><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ESTADO_COLORS[selectedSolicitud.estado] || 'bg-gray-100 text-gray-700'}`}>{selectedSolicitud.estado}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Colegiado (CIP)</span><span className="text-sm text-text-main font-mono">{selectedSolicitud.colegiadoId}</span></div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Beneficiarios que cobran</h4>
                    {detailLoading ? (
                      <p className="text-sm text-text-sec">Cargando...</p>
                    ) : vinculados.length === 0 ? (
                      <p className="text-sm text-text-sec italic">Sin beneficiarios vinculados a este registro.</p>
                    ) : (
                      <ul className="space-y-2">
                        {vinculados.map((b) => (
                          <li key={b.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                            <span className="text-text-main">{b.nombre}<span className="text-text-sec"> · {b.parentesco}{b.dni ? ` · ${b.dni}` : ''}</span></span>
                            <span className="font-semibold text-primary">{b.porcentajeAsignado}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {selectedSolicitud.observaciones && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2">Observaciones</h4>
                      <p className="text-sm text-text-main">{selectedSolicitud.observaciones}</p>
                    </div>
                  )}
                </div>
                <div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Documentos</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span className="text-sm text-text-sec">N.° Expediente</span><span className="text-sm text-text-main font-medium">{selectedSolicitud.expedienteNumero || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">N.° Carta</span><span className="text-sm text-text-main">{selectedSolicitud.cartaNumero || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Fecha Carta</span><span className="text-sm text-text-main">{selectedSolicitud.cartaFecha ? new Date(selectedSolicitud.cartaFecha).toLocaleDateString('es-PE') : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">N.° Memorándum</span><span className="text-sm text-text-main">{selectedSolicitud.memorandoNumero || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Fecha Memorándum</span><span className="text-sm text-text-main">{selectedSolicitud.memorandoFecha ? new Date(selectedSolicitud.memorandoFecha).toLocaleDateString('es-PE') : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Forma de Pago</span><span className="text-sm text-text-main">{selectedSolicitud.formaPago || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Banco</span><span className="text-sm text-text-main">{selectedSolicitud.banco || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Fecha Orden Pago</span><span className="text-sm text-text-main">{selectedSolicitud.ordenPagoFecha ? new Date(selectedSolicitud.ordenPagoFecha).toLocaleDateString('es-PE') : '-'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-border flex justify-end">
              <button onClick={() => setDetailOpen(false)} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
