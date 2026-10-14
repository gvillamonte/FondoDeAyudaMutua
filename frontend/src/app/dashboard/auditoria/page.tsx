'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditLog {
  id: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  changesJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  CREATE: { bg: '#DCFCE7', text: '#166534' },
  UPDATE: { bg: '#DBEAFE', text: '#1E40AF' },
  DELETE: { bg: '#FEE2E2', text: '#991B1B' },
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<AuditMeta>({ total: 0, page: 1, limit: 25, totalPages: 1 });

  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async (page: number, limit: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity', entityFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/audit/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setLogs(result.data || []);
        setMeta(result.meta || { total: 0, page: 1, limit: 25, totalPages: 1 });
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs(meta.page, meta.limit);
  }, [fetchLogs]);

  const handleFilter = () => {
    setMeta((prev) => ({ ...prev, page: 1 }));
    fetchLogs(1, meta.limit);
  };

  const handlePageChange = (newPage: number) => {
    setMeta((prev) => ({ ...prev, page: newPage }));
    fetchLogs(newPage, meta.limit);
  };

  const handleLimitChange = (newLimit: number) => {
    setMeta((prev) => ({ ...prev, limit: newLimit, page: 1 }));
    fetchLogs(1, newLimit);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatChanges = (json: string | null): string => {
    if (!json) return 'N/A';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getPageNumbers = (): (number | string)[] => {
    const { page, totalPages } = meta;
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold" style={{ color: '#1E293B' }}>
          Registro de Auditoria
        </h2>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
          Consulta y monitoreo de acciones realizadas en el sistema
        </p>
      </div>

      {/* Filter Section */}
      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action Dropdown */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#1E293B' }}
            >
              Accion
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
              }}
            >
              <option value="">Todas</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          {/* Entity Input */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#1E293B' }}
            >
              Entidad
            </label>
            <input
              type="text"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              placeholder="Ej: beneficio, pago..."
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
              }}
            />
          </div>

          {/* Start Date */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#1E293B' }}
            >
              Fecha Inicio
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#1E293B' }}
            >
              Fecha Fin
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
              }}
            />
          </div>
        </div>

        {/* Filter Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleFilter}
            className="px-5 py-2 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#3258CA' }}
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: '#1E293B' }}>
            <thead>
              <tr
                className="text-left text-xs font-semibold uppercase tracking-wider"
                style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}
              >
                <th className="px-4 py-3">Fecha/Hora</th>
                <th className="px-4 py-3">Usuario ID</th>
                <th className="px-4 py-3">Accion</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">ID Registro</th>
                <th className="px-4 py-3">Cambios</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: '#64748B' }}>
                    Cargando registros...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: '#64748B' }}>
                    No se encontraron registros de auditoria
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const colors = ACTION_COLORS[log.action] || { bg: '#F3F4F6', text: '#374151' };
                  const isExpanded = expandedRows.has(log.id);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.userId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.entity}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                        {log.entityId}
                      </td>
                      <td className="px-4 py-3">
                        {log.changesJson ? (
                          <button
                            onClick={() => toggleRow(log.id)}
                            className="text-xs underline transition-colors hover:opacity-80"
                            style={{ color: '#3258CA' }}
                          >
                            {isExpanded ? 'Ocultar' : 'Ver cambios'}
                          </button>
                        ) : (
                          <span style={{ color: '#64748B' }}>N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                        {log.ipAddress || 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded changes row */}
        {logs.some((log) => expandedRows.has(log.id) && log.changesJson) && (
          <div style={{ borderTop: '1px solid #E2E8F0' }}>
            {logs.map(
              (log) =>
                expandedRows.has(log.id) &&
                log.changesJson && (
                  <div
                    key={`detail-${log.id}`}
                    className="px-4 py-3"
                    style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="text-xs font-medium mt-0.5 shrink-0"
                        style={{ color: '#64748B' }}
                      >
                        Cambios ({log.entity} - {log.entityId}):
                      </span>
                      <pre
                        className="text-xs rounded-md p-3 overflow-x-auto flex-1 max-h-48"
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          color: '#1E293B',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatChanges(log.changesJson)}
                      </pre>
                    </div>
                  </div>
                )
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.total > 0 && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg px-5 py-3"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
            <span>Mostrando</span>
            <select
              value={meta.limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="rounded-md px-2 py-1 text-sm outline-none"
              style={{ border: '1px solid #E2E8F0', color: '#1E293B' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>de {meta.total} registros</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
              }}
            >
              Anterior
            </button>
            {getPageNumbers().map((p, i) =>
              typeof p === 'string' ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-2 py-1.5 text-sm"
                  style={{ color: '#64748B' }}
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: p === meta.page ? '#3258CA' : '#FFFFFF',
                    border: '1px solid',
                    borderColor: p === meta.page ? '#3258CA' : '#E2E8F0',
                    color: p === meta.page ? '#FFFFFF' : '#1E293B',
                  }}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
