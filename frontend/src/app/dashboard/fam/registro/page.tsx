'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RegistroWizard from '@/components/fam/RegistroWizard';
import HistorialRegistros from '@/components/fam/HistorialRegistros';

function RegistroTabs() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'nuevo' | 'historial'>('nuevo');

  useEffect(() => {
    if (searchParams?.get('tab') === 'historial') setTab('historial');
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-main">Registro FAM</h2>
        <p className="text-text-sec text-sm mt-1">
          Registrar casos completos del Fondo de Asistencia Mutual: beneficiarios, solicitud y documentación
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('nuevo')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              tab === 'nuevo'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-text-sec hover:text-text-main'
            }`}
          >
            Nuevo registro
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              tab === 'historial'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-text-sec hover:text-text-main'
            }`}
          >
            Historial
          </button>
        </div>

        <div className="p-6">
          {tab === 'nuevo' ? (
            <Suspense fallback={
              <div className="py-12 text-center">
                <svg className="animate-spin w-5 h-5 mx-auto text-text-sec" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
            }>
              <RegistroWizard />
            </Suspense>
          ) : (
            <HistorialRegistros />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegistroFAMPage() {
  return (
    <Suspense fallback={null}>
      <RegistroTabs />
    </Suspense>
  );
}
