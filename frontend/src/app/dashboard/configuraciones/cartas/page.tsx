'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function CartasPage() {
  return (
    <CatalogoTable
      endpoint="cartas"
      titulo="Cartas"
      descripcion="Gestión de cartas institucionales. Los números aquí creados se usarán en los formularios de Ayuda COVID."
      columnas={[
        { key: 'numero', label: 'N.° Carta' },
        {
          key: 'fecha',
          label: 'Fecha',
          render: (item) => (
            <span className="text-sm text-text-main">
              {item.fecha ? new Date(item.fecha).toLocaleDateString('es-PE') : '-'}
            </span>
          ),
        },
        { key: 'referencia', label: 'Referencia' },
        {
          key: 'activo',
          label: 'Estado',
          render: (item) => (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              item.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {item.activo ? 'Activo' : 'Inactivo'}
            </span>
          ),
        },
      ]}
      campos={[
        { key: 'numero', label: 'N.° Carta', required: true, placeholder: 'CART-0123-2021' },
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'referencia', label: 'Referencia', placeholder: 'Referencia de la carta' },
        { key: 'activo', label: 'Activo', type: 'checkbox' },
      ]}
    />
  );
}
