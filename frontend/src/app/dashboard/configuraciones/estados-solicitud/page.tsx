'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function EstadosSolicitudPage() {
  return (
    <CatalogoTable
      endpoint="estados-solicitudes"
      titulo="Estados de Solicitud"
      descripcion="Catálogo de estados del flujo de solicitudes de beneficio"
      columnas={[
        { key: 'orden', label: 'Orden', render: (i) => <span className="text-sm text-text-sec">{i.orden}</span> },
        { key: 'nombre', label: 'Estado', render: (i) => <span className="text-sm font-semibold text-text-main">{i.nombre}</span> },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activo', label: 'Estado', render: (i) => (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {i.activo ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      campos={[
        { key: 'nombre', label: 'Nombre del estado', required: true, placeholder: 'Ej: Pendiente' },
        { key: 'descripcion', label: 'Descripción', placeholder: 'Descripción del estado' },
        { key: 'orden', label: 'Orden en el flujo', type: 'number', placeholder: 'Ej: 1' },
        { key: 'activo', label: 'Activo', type: 'checkbox', hideOnCreate: true },
      ]}
    />
  );
}
