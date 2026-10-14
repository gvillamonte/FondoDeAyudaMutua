'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Estadisticas {
  solicitudes: {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
    pagadas: number;
  };
  pagos: {
    total: number;
    montoTotal: number;
    promedio: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/pagos/estadisticas');
      setStats(data.data || data);
      setError(false);
    } catch {
      setError(true);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-sec">Cargando estadisticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-main">Dashboard</h2>
        <p className="text-text-sec mt-1">Resumen general del sistema</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          No se pudieron cargar las estadisticas. Verifique su sesion e intente nuevamente.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Solicitudes" value={stats.solicitudes.total} color="primary" />
            <StatCard title="Pendientes" value={stats.solicitudes.pendientes} color="warning" />
            <StatCard title="Aprobadas" value={stats.solicitudes.aprobadas} color="success" />
            <StatCard title="Pagos Completados" value={stats.pagos.total} color="primary" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card flex flex-col">
              <h3 className="text-lg font-semibold text-text-main">Monto Total Pagado</h3>
              <div className="flex-1 flex items-center">
                <p className="text-3xl font-bold text-primary">
                  S/ {stats.pagos.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="mt-auto pt-4 border-t border-border-main space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-sec">Pagos completados</span>
                  <span className="text-text-main font-medium">{stats.pagos.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-sec">Promedio por pago</span>
                  <span className="text-text-main font-medium">
                    S/ {stats.pagos.promedio.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="card flex flex-col">
              <h3 className="text-lg font-semibold text-text-main">Distribucion de Solicitudes</h3>
              <div className="space-y-3 mt-4 flex-1 flex flex-col justify-between">
                <StatusRow label="Pendientes" value={stats.solicitudes.pendientes} total={stats.solicitudes.total} color="bg-warning" />
                <StatusRow label="Aprobadas" value={stats.solicitudes.aprobadas} total={stats.solicitudes.total} color="bg-success" />
                <StatusRow label="Rechazadas" value={stats.solicitudes.rechazadas} total={stats.solicitudes.total} color="bg-error" />
                <StatusRow label="Pagadas" value={stats.solicitudes.pagadas} total={stats.solicitudes.total} color="bg-primary" />
              </div>
              <div className="mt-auto pt-4 border-t border-border-main flex items-center justify-between text-sm">
                <span className="text-text-sec">Total de solicitudes</span>
                <span className="text-text-main font-medium">{stats.solicitudes.total}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'border-l-primary',
    warning: 'border-l-warning',
    success: 'border-l-success',
    error: 'border-l-error',
  };
  return (
    <div className={`card border-l-4 ${colorMap[color] || 'border-l-primary'}`}>
      <p className="text-sm text-text-sec">{title}</p>
      <p className="text-2xl font-bold text-text-main mt-1">{value}</p>
    </div>
  );
}

function StatusRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-text-sec">{label}</span>
        <span className="text-text-main font-medium">{value}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
