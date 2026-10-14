'use client';

import CatalogoTable from '@/components/configuraciones/CatalogoTable';

export default function MontosFamPage() {
  return (
    <CatalogoTable
      endpoint="montos-fam"
      titulo="Montos FAM"
      descripcion="Montos predeterminados del Fondo de Asistencia Mutual según el tipo de evento"
      columnas={[
        { key: 'nombre', label: 'Concepto', render: (i) => <span className="text-sm font-semibold text-text-main">{i.nombre}</span> },
        { key: 'monto', label: 'Monto', render: (i) => <span className="text-sm font-medium text-text-main">S/ {Number(i.monto).toFixed(2)}</span> },
        { key: 'aplicaA', label: 'Aplica A', render: (i) => <span className="text-sm text-text-sec">{i.aplicaA || '-'}</span> },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activo', label: 'Estado', render: (i) => (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {i.activo ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      campos={[
        { key: 'nombre', label: 'Concepto', required: true, placeholder: 'Ej: Fallecimiento del Titular' },
        { key: 'monto', label: 'Monto (S/)', type: 'number', required: true, placeholder: 'Ej: 3000' },
        {
          key: 'aplicaA', label: 'Aplica a (tipo de evento)', type: 'select',
          options: [
            { value: 'FALLECIMIENTO', label: 'Fallecimiento' },
            { value: 'INCAPACIDAD', label: 'Incapacidad / Accidente grave' },
            { value: 'ENF_TERMINAL', label: 'Enfermedad Terminal' },
          ],
        },
        { key: 'descripcion', label: 'Descripción', placeholder: 'Descripción del monto' },
        { key: 'activo', label: 'Activo', type: 'checkbox', hideOnCreate: true },
      ]}
    />
  );
}
