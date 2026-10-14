'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Drawer from '@/components/ui/Drawer';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import BeneficioForm from '@/components/beneficios/BeneficioForm';
import api from '@/lib/api';

export default function BeneficiosPage() {
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBeneficio, setSelectedBeneficio] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<any>(null);

  useEffect(() => {
    fetchBeneficios();
  }, [page, limit, search]);

  const fetchBeneficios = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;

      const { data } = await api.get('/beneficios', { params });
      setBeneficios(data.data || []);
      setTotal(data.meta?.total || 0);
    } catch {
      setBeneficios([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSolicitud = async (data: any) => {
    try {
      await api.post('/pagos/solicitudes', data);
      setDrawerOpen(false);
      fetchBeneficios();
    } catch {}
  };

  const handleToggleActivo = async (id: string) => {
    try {
      await api.put(`/beneficios/${id}/toggle-activo`);
      fetchBeneficios();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/beneficios/${deleteModal.id}`);
      setDeleteModal(null);
      fetchBeneficios();
    } catch {}
  };

  const columns = [
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'tipo', label: 'Tipo', sortable: true },
    {
      key: 'montoBase',
      label: 'Monto Base',
      sortable: true,
      render: (item: any) => `S/ ${Number(item.montoBase).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'activo',
      label: 'Estado',
      render: (item: any) => (
        <span className={`badge ${item.activo ? 'badge-approved' : 'badge-rejected'}`}>
          {item.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'requiereJunta',
      label: 'Requiere Junta',
      render: (item: any) => (
        <span className={`badge ${item.requiereJunta ? 'badge-pending' : 'badge-approved'}`}>
          {item.requiereJunta ? 'Si' : 'No'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-main">Beneficios</h2>
          <p className="text-text-sec mt-1">Catalogo de beneficios disponibles</p>
        </div>
        <Button onClick={() => { setSelectedBeneficio(null); setDrawerOpen(true); }}>
          Nuevo Beneficio
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={beneficios}
        totalItems={total}
        currentPage={page}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={setLimit}
        onSearch={setSearch}
        loading={loading}
        emptyMessage="No se encontraron beneficios"
        actions={(item) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedBeneficio(item); setDrawerOpen(true); }}
              className="text-primary hover:text-primary-dark transition-colors text-sm"
            >
              Solicitar
            </button>
            <button
              onClick={() => handleToggleActivo(item.id)}
              className="text-text-sec hover:text-text-main transition-colors text-sm"
            >
              {item.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button
              onClick={() => setDeleteModal(item)}
              className="text-error hover:text-red-700 transition-colors text-sm"
            >
              Eliminar
            </button>
          </div>
        )}
      />

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Nueva Solicitud de Beneficio" width="w-[500px]">
        <BeneficioForm
          beneficio={selectedBeneficio}
          onSubmit={handleSubmitSolicitud}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Eliminar Beneficio"
        onConfirm={handleDelete}
        confirmText="Eliminar"
        confirmVariant="danger"
      >
        <p className="text-text-sec">
          Esta seguro de eliminar el beneficio <strong>{deleteModal?.nombre}</strong>?
        </p>
      </Modal>
    </div>
  );
}
