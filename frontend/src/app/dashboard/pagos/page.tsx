'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';

export default function PagosPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'pagos'>('solicitudes');
  const [resolverModal, setResolverModal] = useState<any>(null);
  const [resolverForm, setResolverForm] = useState({ estado: 'APROBADA', montoAprobado: 0, observaciones: '' });

  useEffect(() => {
    fetchData();
  }, [page, limit, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'solicitudes' ? '/pagos/solicitudes' : '/pagos';
      const { data } = await api.get(endpoint, { params: { page, limit } });

      if (activeTab === 'solicitudes') {
        setSolicitudes(data.data || []);
      } else {
        setPagos(data.data || []);
      }
      setTotal(data.meta?.total || 0);
    } catch {
      setSolicitudes([]);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolver = async () => {
    if (!resolverModal) return;
    try {
      await api.put(`/pagos/solicitudes/${resolverModal.id}/resolver`, resolverForm);
      setResolverModal(null);
      fetchData();
    } catch {}
  };

  const solicitudColumns = [
    { key: 'beneficio', label: 'Beneficio', render: (item: any) => item.beneficio?.nombre || 'N/A' },
    { key: 'colegiadoId', label: 'Colegiado' },
    {
      key: 'montoSolicitado',
      label: 'Monto',
      render: (item: any) => `S/ ${Number(item.montoSolicitado).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
    },
    { key: 'motivo', label: 'Motivo' },
    {
      key: 'estado',
      label: 'Estado',
      render: (item: any) => {
        const cls: Record<string, string> = { PENDIENTE: 'badge-pending', APROBADA: 'badge-approved', RECHAZADA: 'badge-rejected', PAGADA: 'badge-paid' };
        return <span className={`badge ${cls[item.estado] || 'badge-pending'}`}>{item.estado}</span>;
      },
    },
  ];

  const pagoColumns = [
    { key: 'colegiadoId', label: 'Colegiado' },
    { key: 'montoPagado', label: 'Monto', render: (item: any) => `S/ ${Number(item.montoPagado).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` },
    { key: 'medioPago', label: 'Medio' },
    { key: 'referenciaPago', label: 'Referencia' },
    { key: 'estado', label: 'Estado', render: (item: any) => <span className={`badge ${item.estado === 'COMPLETADO' ? 'badge-approved' : 'badge-rejected'}`}>{item.estado}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Pagos y Solicitudes</h2>
        <p className="text-text-sec mt-1">Gestion de solicitudes y pagos de beneficios</p>
      </div>

      <div className="flex gap-4 border-b border-border-main">
        <button onClick={() => { setActiveTab('solicitudes'); setPage(1); }}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'solicitudes' ? 'border-primary text-primary' : 'border-transparent text-text-sec hover:text-text-main'}`}>
          Solicitudes
        </button>
        <button onClick={() => { setActiveTab('pagos'); setPage(1); }}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pagos' ? 'border-primary text-primary' : 'border-transparent text-text-sec hover:text-text-main'}`}>
          Pagos Registrados
        </button>
      </div>

      {activeTab === 'solicitudes' ? (
        <DataTable columns={solicitudColumns} data={solicitudes} totalItems={total} currentPage={page} pageSize={limit}
          onPageChange={setPage} onPageSizeChange={setLimit} loading={loading} emptyMessage="No hay solicitudes"
          actions={(item) => (
            <div className="flex items-center gap-2">
              {item.estado === 'PENDIENTE' && (
                <button onClick={() => { setResolverModal(item); setResolverForm({ estado: 'APROBADA', montoAprobado: item.montoSolicitado, observaciones: '' }); }}
                  className="text-primary hover:text-primary-dark transition-colors text-sm">Resolver</button>
              )}
            </div>
          )} />
      ) : (
        <DataTable columns={pagoColumns} data={pagos} totalItems={total} currentPage={page} pageSize={limit}
          onPageChange={setPage} onPageSizeChange={setLimit} loading={loading} emptyMessage="No hay pagos registrados" />
      )}

      <Modal isOpen={!!resolverModal} onClose={() => setResolverModal(null)} title="Resolver Solicitud" onConfirm={handleResolver} confirmText="Guardar">
        <div className="space-y-4">
          <div>
            <label className="label-field">Estado</label>
            <select value={resolverForm.estado} onChange={(e) => setResolverForm({ ...resolverForm, estado: e.target.value })} className="input-field">
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="EN_REVISION">En Revision</option>
            </select>
          </div>
          <div>
            <label className="label-field">Monto Aprobado (S/)</label>
            <input type="number" step="0.01" value={resolverForm.montoAprobado}
              onChange={(e) => setResolverForm({ ...resolverForm, montoAprobado: parseFloat(e.target.value) })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Observaciones</label>
            <textarea value={resolverForm.observaciones} onChange={(e) => setResolverForm({ ...resolverForm, observaciones: e.target.value })} className="input-field" rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
