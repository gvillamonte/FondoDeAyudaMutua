'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

export default function ColegiadosPage() {
  const [colegiados, setColegiados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchColegiados();
  }, [page, limit, search]);

  const fetchColegiados = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;

      const { data } = await api.get('/legacy/colegiados/search', { params });
      setColegiados(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setColegiados([]);
      setError('Error al cargar colegiados. Verifique su sesion o intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'NUM_COLEGIATURA', label: 'N. Colegiatura', sortable: true },
    { key: 'DNI', label: 'DNI', sortable: true },
    {
      key: 'nombre',
      label: 'Nombre Completo',
      sortable: true,
      render: (item: any) => `${item.NOMBRES} ${item.APELLIDO_PATERNO} ${item.APELLIDO_MATERNO || ''}`,
    },
    { key: 'ESTADO_COLEGIATURA', label: 'Estado', sortable: true },
    {
      key: 'FECHA_INGRESO',
      label: 'F. Incorporacion',
      sortable: true,
      render: (item: any) =>
        item.FECHA_INGRESO ? new Date(item.FECHA_INGRESO).toLocaleDateString('es-PE') : '-',
    },
    {
      key: 'FECHA_ULTIMO_PAGO',
      label: 'Ultimo Pago',
      sortable: true,
      render: (item: any) =>
        item.FECHA_ULTIMO_PAGO ? new Date(item.FECHA_ULTIMO_PAGO).toLocaleDateString('es-PE') : '-',
    },
    { key: 'ESPECIALIDAD', label: 'Especialidad' },
    { key: 'TELEFONO', label: 'Telefono' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Colegiados</h2>
        <p className="text-text-sec mt-1">Consulta del padron maestro de colegiados</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <DataTable
        columns={columns}
        data={colegiados}
        totalItems={total}
        currentPage={page}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={setLimit}
        onSearch={(term) => { setSearch(term); setPage(1); }}
        loading={loading}
        emptyMessage="No se encontraron colegiados"
      />
    </div>
  );
}
