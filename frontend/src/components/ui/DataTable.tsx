'use client';

import { useEffect, useRef, useState } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onSearch?: (term: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSort,
  onSearch,
  loading = false,
  emptyMessage = 'No se encontraron registros',
  actions,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const totalPages = Math.ceil(totalItems / pageSize);

  // Debounce: sin esto se dispara una consulta al servidor por cada tecla.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onSearch?.(term), 450);
  };

  const handleSort = (key: string) => {
    const direction = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="card p-0 overflow-hidden">
      {/* Barra de búsqueda y paginación */}
      <div className="p-3 sm:p-4 border-b border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Buscar por DNI, N° colegiatura o nombre..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-text-sec">Mostrar:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="input-field w-auto"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="text-sm text-text-sec">registros</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="table-header">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left ${col.sortable ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && getSortIcon(col.key)}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-left">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-text-sec">
                  Cargando...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-text-sec">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={index} className="hover:bg-bg-layout transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm text-text-main">
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3">
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="p-3 sm:p-4 border-t border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-text-sec">
          Mostrando {((currentPage - 1) * pageSize) + 1} a{' '}
          {Math.min(currentPage * pageSize, totalItems)} de {totalItems} registros
        </p>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="btn-secondary text-sm px-3 py-1 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-text-sec px-2">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="btn-secondary text-sm px-3 py-1 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
