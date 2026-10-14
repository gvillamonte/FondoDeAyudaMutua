'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function TiposBeneficioPage() {
  return (
    <CatalogoTable
      endpoint="tipos-beneficio-config"
      titulo="Tipos de Beneficio"
      descripcion="Catálogo de tipos de beneficio del módulo de Beneficios"
      columnas={[
        { key: 'nombre', label: 'Tipo', render: (i) => <span className="text-sm font-semibold text-text-main">{i.nombre}</span> },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activo', label: 'Estado', render: (i) => (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {i.activo ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      campos={[
        { key: 'nombre', label: 'Nombre del tipo', required: true, placeholder: 'Ej: Asistencia Económica' },
        { key: 'descripcion', label: 'Descripción', placeholder: 'Descripción del tipo' },
        { key: 'activo', label: 'Activo', type: 'checkbox', hideOnCreate: true },
      ]}
    />
  );
}
