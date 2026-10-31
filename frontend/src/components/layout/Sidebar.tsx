'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MenuItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Colegiados',
    href: '/dashboard/colegiados',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Act. de Datos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    children: [
      { label: 'Quiénes actualizaron datos', href: '/dashboard/actualizacion-datos' },
      { label: 'Portal Colegiado', href: '/actualizar-datos' },
    ],
  },
  {
    label: 'Beneficios',
    href: '/dashboard/beneficios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Pagos',
    href: '/dashboard/pagos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Caja',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    children: [
      { label: 'Consulta Cobros', href: '/dashboard/caja/consulta-cobros' },
      { label: 'Cobrar Aportaciones', href: '/dashboard/caja/cobrar-aportaciones' },
      { label: 'Cobrar Ordinarios', href: '/dashboard/caja/cobrar-ordinarios' },
      { label: 'Cobrar IEPI', href: '/dashboard/caja/cobrar-iepi' },
    ],
  },
  {
    label: 'Tesorería',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    children: [
      { label: 'Fraccionamiento Deuda', href: '/dashboard/tesoreria/fraccionamiento-deuda' },
    ],
  },
  {
    label: 'FAM',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    children: [
      { label: 'Beneficiarios', href: '/dashboard/fam' },
      { label: 'Registro', href: '/dashboard/fam/registro' },
      { label: 'Carga Masiva', href: '/dashboard/fam/carga-masiva' },
      { label: 'Expedientes de Beneficio', href: '/dashboard/fam/expedientes' },
      { label: 'Configuración SLA', href: '/dashboard/fam/config-sla' },
      { label: 'Ayuda COVID', href: '/dashboard/fam/covid' },
      { label: 'Pagos Estimados', href: '/dashboard/fam/pagos-estimados' },
    ],
  },
  {
    label: 'Reportes',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    children: [
      { label: 'Estados de Habilidad', href: '/dashboard/reportes/estados-habilidad' },
    ],
  },
  {
    label: 'Configuraciones',
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    children: [
      { label: 'Montos FAM', href: '/dashboard/configuraciones/montos-fam' },
      { label: 'Métodos de Pago', href: '/dashboard/configuraciones/metodos-pago' },
      { label: 'Estados Solicitud', href: '/dashboard/configuraciones/estados-solicitud' },
      { label: 'Tipos Beneficio', href: '/dashboard/configuraciones/tipos-beneficio' },
      { label: 'Monedas', href: '/dashboard/configuraciones/monedas' },
      { label: 'Memorándums', href: '/dashboard/configuraciones/memorandos' },
      { label: 'Cartas', href: '/dashboard/configuraciones/cartas' },
    ],
  },
  {
    label: 'Auditoría',
    href: '/dashboard/auditoria',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setRol(JSON.parse(stored).rol || null);
    } catch {}
  }, []);

  // Auto-expandir solo el grupo de la ruta activa
  useEffect(() => {
    const grupo = menuItems.find((item) => item.children?.some((c) => c.href === pathname));
    if (grupo) {
      setOpenGroups((prev) => (prev.includes(grupo.label) ? prev : [...prev, grupo.label]));
    }
  }, [pathname]);

  const visibleItems = menuItems.filter((item) => !item.adminOnly || rol === 'ADMINISTRADOR');

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <aside
      className={`bg-primary text-white transition-transform lg:transition-all duration-300 flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 w-64
        lg:static lg:z-auto lg:translate-x-0 lg:inset-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-primary-dark">
        <span className={`text-lg font-semibold ${collapsed ? 'lg:hidden' : ''}`}>Sistema CIP</span>
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-primary-dark transition-colors" aria-label="Cerrar menú">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-primary-dark transition-colors hidden lg:block" aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {collapsed ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />}
            </svg>
          </button>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          if (item.children) {
            const isGroupOpen = openGroups.includes(item.label);
            const isChildActive = item.children.some((c) => pathname === c.href);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                    isChildActive ? 'bg-primary-dark text-white' : 'text-blue-100 hover:bg-primary-dark hover:text-white'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <>
                    <span className={`ml-3 flex-1 text-left ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                    <svg className={`w-4 h-4 transition-transform ${isGroupOpen ? 'rotate-90' : ''} ${collapsed ? 'lg:hidden' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                </button>
                {isGroupOpen && (
                  <div className={`bg-primary-dark/30 ${collapsed ? 'lg:hidden' : ''}`}>
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center pl-14 pr-4 py-2 text-sm transition-colors ${
                            isActive ? 'bg-primary-dark text-white font-medium' : 'text-blue-200 hover:bg-primary-dark/50 hover:text-white'
                          }`}
                        >
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onClose}
              className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary-dark text-white' : 'text-blue-100 hover:bg-primary-dark hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className={`ml-3 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-dark">
        <p className={`text-xs text-blue-200 text-center ${collapsed ? 'lg:hidden' : ''}`}>v1.0.0 - Sistema CIP</p>
      </div>
    </aside>
  );
}
