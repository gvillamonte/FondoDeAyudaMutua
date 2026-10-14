'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function MetodosPagoPage() {
  return (
    <CatalogoTable
      endpoint="metodos-pagos"
      titulo="Métodos de Pago"
      descripcion="Administrar los métodos de pago disponibles para registrar transacciones"
      columnas={[
        { key: 'nombre', label: 'Método', render: (i) => <span className="text-sm font-semibold text-text-main">{i.nombre}</span> },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'requiereReferencia', label: 'Req. Referencia', render: (i) => <span className="text-sm text-text-main">{i.requiereReferencia ? 'Sí' : 'No'}</span> },
        { key: 'activo', label: 'Estado', render: (i) => (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {i.activo ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      campos={[
        { key: 'nombre', label: 'Nombre del método', required: true, placeholder: 'Ej: Transferencia Bancaria' },
        { key: 'descripcion', label: 'Descripción', placeholder: 'Descripción del método' },
        { key: 'requiereReferencia', label: 'Requiere número de referencia al registrar pagos', type: 'checkbox' },
        { key: 'activo', label: 'Activo', type: 'checkbox', hideOnCreate: true },
      ]}
    />
  );
}
