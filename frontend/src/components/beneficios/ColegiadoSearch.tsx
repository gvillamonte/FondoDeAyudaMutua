'use client';

import { useState, useEffect } from 'react';
import { parseJsonSafe } from '@/lib/safe-json';

interface Colegiado {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRES: string;
  APELLIDO_PATERNO: string;
  APELLIDO_MATERNO: string;
}

interface ColegiadoSearchProps {
  onSelect: (colegiado: Colegiado) => void;
  selectedColegiado?: Colegiado | null;
}

export default function ColegiadoSearch({ onSelect, selectedColegiado }: ColegiadoSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Colegiado[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchColegiados(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchColegiados = async (term: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/legacy/colegiados/search?search=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await parseJsonSafe<{ data?: Colegiado[] }>(response);
        setResults(data.data || []);
        setIsOpen(true);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (colegiado: Colegiado) => {
    onSelect(colegiado);
    setSearchTerm('');
    setIsOpen(false);
  };

  const formatNombre = (c: Colegiado) =>
    `${c.NOMBRES} ${c.APELLIDO_PATERNO} ${c.APELLIDO_MATERNO || ''}`.trim();

  return (
    <div className="relative">
      {selectedColegiado ? (
        <div className="flex items-center justify-between p-3 bg-bg-layout rounded-lg border border-border-main">
          <div>
            <p className="font-medium text-text-main">{formatNombre(selectedColegiado)}</p>
            <p className="text-sm text-text-sec">
              DNI: {selectedColegiado.DNI} | N° Colegiatura: {selectedColegiado.NUM_COLEGIATURA}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null as any)}
            className="text-text-sec hover:text-error transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por DNI, N° Colegiatura o nombre..."
            className="input-field"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-4 w-4 text-text-sec" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
          {isOpen && results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-border-main rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map((colegiado) => (
                <button
                  key={colegiado.COLEGIADO_ID}
                  type="button"
                  onClick={() => handleSelect(colegiado)}
                  className="w-full px-4 py-3 text-left hover:bg-bg-layout transition-colors border-b border-border-main last:border-b-0"
                >
                  <p className="font-medium text-text-main">{formatNombre(colegiado)}</p>
                  <p className="text-sm text-text-sec">
                    DNI: {colegiado.DNI} | N° {colegiado.NUM_COLEGIATURA}
                  </p>
                </button>
              ))}
            </div>
          )}
          {isOpen && searchTerm.length >= 2 && results.length === 0 && !loading && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-border-main rounded-lg shadow-lg p-4 text-center text-text-sec">
              No se encontraron colegiados
            </div>
          )}
        </div>
      )}
    </div>
  );
}
