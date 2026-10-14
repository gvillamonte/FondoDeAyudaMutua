'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-500',
  EN_REVISION: 'bg-blue-500',
  APROBADA: 'bg-green-500',
  RECHAZADA: 'bg-red-500',
  PAGADA: 'bg-emerald-500',
};

interface SlaConfig {
  id: number;
  estado: string;
  nombreVisible: string;
  horasLimite: number;
  colorBadge: string;
  ordenFlujo: number;
}

export default function ConfigSlaPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<SlaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<SlaConfig>>({});

  useEffect(() => {
    cargarConfigs();
  }, []);

  const cargarConfigs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/expediente-sla/config');
      setConfigs(Array.isArray(data) ? data : []);
    } catch {
      setError('Error al cargar configuración SLA');
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicion = (cfg: SlaConfig) => {
    setEditando(cfg.id);
    setForm({ ...cfg });
    setError('');
    setExito('');
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm({});
  };

  const guardarConfig = async () => {
    if (!form.id || !form.horasLimite || form.horasLimite < 0) {
      setError('Las horas límite deben ser un número positivo');
      return;
    }
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await api.put(`/expediente-sla/config/${form.id}`, {
        horasLimite: form.horasLimite,
        nombreVisible: form.nombreVisible,
        colorBadge: form.colorBadge,
        ordenFlujo: form.ordenFlujo,
      });
      setExito('Configuración actualizada correctamente');
      setEditando(null);
      setForm({});
      cargarConfigs();
    } catch {
      setError('Error al guardar configuración');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/fam/expedientes')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-main">Configuración SLA</h1>
            <p className="text-xs text-text-sec">Tiempos límite para cada estado del expediente</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
        {exito && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">{exito}</div>}

        {loading ? (
          <div className="bg-white border border-border rounded-lg p-12 text-center text-text-sec text-sm">Cargando...</div>
        ) : configs.length === 0 ? (
          <div className="bg-white border border-border rounded-lg p-12 text-center text-text-sec text-sm">No hay configuraciones SLA</div>
        ) : (
          <div className="space-y-3">
            {configs.map((cfg) => (
              <div key={cfg.id} className={`bg-white border rounded-lg p-4 transition-colors ${editando === cfg.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
                {editando === cfg.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${ESTADO_COLORS[cfg.estado] || 'bg-gray-400'}`} />
                      <span className="text-sm font-semibold text-text-main">{cfg.nombreVisible}</span>
                      <span className="text-[10px] text-text-sec ml-1">({cfg.estado})</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Horas Límite</label>
                        <input type="number" min={0} value={form.horasLimite ?? 0}
                          onChange={(e) => setForm({ ...form, horasLimite: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Nombre Visible</label>
                        <input type="text" value={form.nombreVisible ?? ''}
                          onChange={(e) => setForm({ ...form, nombreVisible: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Color Badge</label>
                        <input type="text" value={form.colorBadge ?? ''}
                          onChange={(e) => setForm({ ...form, colorBadge: e.target.value })}
                          placeholder="#3258CA" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-sec uppercase mb-1">Orden Flujo</label>
                        <input type="number" min={0} value={form.ordenFlujo ?? 0}
                          onChange={(e) => setForm({ ...form, ordenFlujo: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelarEdicion}
                        className="px-4 py-2 text-xs font-medium text-text-sec border border-border rounded-lg hover:bg-gray-50 transition-colors">
                        Cancelar
                      </button>
                      <button onClick={guardarConfig} disabled={guardando}
                        className="px-4 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {guardando ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${ESTADO_COLORS[cfg.estado] || 'bg-gray-400'}`} />
                      <div>
                        <div className="text-sm font-semibold text-text-main">{cfg.nombreVisible}</div>
                        <div className="text-[10px] text-text-sec">{cfg.estado} — Orden: {cfg.ordenFlujo}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-text-main">{cfg.horasLimite}h</span>
                      <button onClick={() => iniciarEdicion(cfg)}
                        className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
                        Editar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
