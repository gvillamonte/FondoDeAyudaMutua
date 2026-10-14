'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function MonedasPage() {
  return (
    <CatalogoTable
      endpoint="monedas"
      titulo="Monedas"
      descripcion="Monedas disponibles para el registro de beneficios y pagos"
      columnas={[
        { key: 'nombre', label: 'Moneda', render: (i) => <span className="text-sm font-semibold text-text-main">{i.nombre}</span> },
        { key: 'simbolo', label: 'Símbolo', render: (i) => <span className="text-sm font-medium text-primary">{i.simbolo}</span> },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activo', label: 'Estado', render: (i) => (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {i.activo ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      campos={[
        { key: 'nombre', label: 'Nombre de la moneda', required: true, placeholder: 'Ej: Sol Peruano' },
        { key: 'simbolo', label: 'Símbolo', required: true, placeholder: 'Ej: S/' },
        { key: 'descripcion', label: 'Descripción', placeholder: 'Descripción de la moneda' },
        { key: 'activo', label: 'Activa', type: 'checkbox', hideOnCreate: true },
      ]}
    />
  );
}
