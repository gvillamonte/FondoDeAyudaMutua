'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function MemorandosPage() {
  return (
    <CatalogoTable
      endpoint="memorandos"
      titulo="Memorándums"
      descripcion="Gestión de memorándums institucionales. Los números aquí creados se usarán en los formularios de Ayuda COVID."
      columnas={[
        { key: 'numero', label: 'N.° Memorándum' },
        {
          key: 'fecha',
          label: 'Fecha',
          render: (item) => (
            <span className="text-sm text-text-main">
              {item.fecha ? new Date(item.fecha).toLocaleDateString('es-PE') : '-'}
            </span>
          ),
        },
        { key: 'asunto', label: 'Asunto' },
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
        { key: 'numero', label: 'N.° Memorándum', required: true, placeholder: 'MEM-045-2021' },
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'asunto', label: 'Asunto', placeholder: 'Asunto o referencia del memorándum' },
        { key: 'activo', label: 'Activo', type: 'checkbox' },
      ]}
    />
  );
}
