'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

interface MenuItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'colegiados',
    label: 'Colegiados',
    href: '/dashboard/colegiados',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'actualizacion-datos',
    label: 'Act. de Datos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    children: [
      { label: 'Quiénes actualizaron datos', href: '/dashboard/actualizacion-datos' },
      { label: 'Plantilla de Correo', href: '/dashboard/actualizacion-datos/correo' },
      { label: 'Portal Colegiado', href: '/actualizar-datos' },
    ],
  },
  {
    id: 'beneficios',
    label: 'Beneficios',
    href: '/dashboard/beneficios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'pagos',
    label: 'Pagos',
    href: '/dashboard/pagos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'caja',
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
    id: 'tesoreria',
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
    id: 'fam',
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
    id: 'reportes',
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
    id: 'configuraciones',
    label: 'Configuraciones',
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
    id: 'usuarios',
    label: 'Usuarios y Roles',
    href: '/dashboard/usuarios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    href: '/dashboard/auditoria',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [modulos, setModulos] = useState<string[] | null>(null);

  // Carga inicial y sincronización con el backend
  const syncProfile = async () => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.rol) setRol(parsed.rol);
        if (Array.isArray(parsed.modulos)) setModulos(parsed.modulos);
      }

      // Consulta al endpoint oficial para obtener permisos actualizados en tiempo real
      const token = localStorage.getItem('accessToken');
      if (token) {
        const res = await api.get('/auth/me');
        if (res.data) {
          setRol(res.data.rol || null);
          if (Array.isArray(res.data.modulos)) {
            setModulos(res.data.modulos);
            // Actualizar localStorage para mantener consistencia
            const current = stored ? JSON.parse(stored) : {};
            current.rol = res.data.rol;
            current.modulos = res.data.modulos;
            localStorage.setItem('user', JSON.stringify(current));
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    syncProfile();

    const handleAuthChange = () => syncProfile();
    window.addEventListener('auth-updated', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('auth-updated', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  // Auto-expandir el grupo de la ruta activa cuando no está colapsado
  useEffect(() => {
    const grupo = menuItems.find((item) => item.children?.some((c) => c.href === pathname));
    if (grupo && !collapsed) {
      setOpenGroups((prev) => (prev.includes(grupo.label) ? prev : [...prev, grupo.label]));
    }
  }, [pathname, collapsed]);

  // Filtrado de módulos según rol y permisos activos
  const visibleItems = useMemo(() => {
    // Administrador principal tiene acceso completo
    if (rol === 'ADMINISTRADOR' || rol === 'SUPER_ADMINISTRADOR') {
      return menuItems;
    }

    // Si tiene lista de módulos configurada para su rol
    if (Array.isArray(modulos)) {
      return menuItems.filter((item) => modulos.includes(item.id));
    }

    // Fallback por defecto si no ha terminado de cargar permisos
    return menuItems.filter((item) => !item.adminOnly);
  }, [rol, modulos]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <aside
      className={`bg-[#8f0404] text-white transition-all duration-300 flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50
        lg:static lg:z-auto lg:translate-x-0 lg:inset-auto
        ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${collapsed ? 'lg:w-16' : 'lg:w-64'} shadow-xl border-r border-[#730202]`}
    >
      {/* Header del Sidebar */}
      <div className="flex items-center justify-between p-3.5 border-b border-[#730202] bg-black/10">
        <div className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'lg:justify-center lg:w-full' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-white text-[#8f0404] font-black flex items-center justify-center text-sm shadow-md flex-shrink-0">
            CIP
          </div>
          <div className={`${collapsed ? 'lg:hidden' : 'block'} truncate`}>
            <span className="text-sm font-bold tracking-tight text-white block leading-tight truncate">
              Sistema ERP
            </span>
            <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider block truncate">
              Colegio de Ingenieros
            </span>
          </div>
        </div>

        {/* Botón de cierre en móvil */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded hover:bg-black/20 text-rose-200 hover:text-white transition-colors"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Botón de alternar colapso en desktop */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex p-1 rounded hover:bg-black/20 text-rose-200 hover:text-white transition-colors ${
              collapsed ? 'hidden' : 'block'
            }`}
            title="Colapsar barra lateral"
            aria-label="Colapsar barra lateral"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {visibleItems.map((item) => {
          // Opción con Submenú (Grupos)
          if (item.children) {
            const isGroupOpen = openGroups.includes(item.label);
            const isChildActive = item.children.some((c) => pathname === c.href);

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => collapsed && setHoveredGroup(item.id)}
                onMouseLeave={() => collapsed && setHoveredGroup(null)}
              >
                <button
                  onClick={() => {
                    if (collapsed && onToggleCollapse) {
                      onToggleCollapse();
                    }
                    toggleGroup(item.label);
                  }}
                  className={`w-full flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${
                    isChildActive
                      ? 'bg-black/30 text-white border-l-4 border-white font-semibold shadow-inner'
                      : 'text-rose-100 hover:bg-black/20 hover:text-white'
                  } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="ml-3 flex-1 text-left truncate">{item.label}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${isGroupOpen ? 'rotate-90 text-white' : 'text-rose-200'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Submenú en modo Expandido */}
                {!collapsed && isGroupOpen && (
                  <div className="bg-black/25 border-l border-white/20 py-1">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center pl-12 pr-4 py-2 text-xs transition-colors ${
                            isActive
                              ? 'bg-black/40 text-white font-semibold'
                              : 'text-rose-200/90 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Flyout flotante en modo Colapsado (Desktop) */}
                {collapsed && hoveredGroup === item.id && (
                  <div
                    className="hidden lg:block absolute left-full top-0 ml-1.5 w-56 bg-[#730202] border border-white/20 rounded-md shadow-2xl py-2 z-50 animate-fadeIn text-white"
                  >
                    <div className="px-3 py-1.5 border-b border-white/20 text-xs font-bold text-white uppercase tracking-wider">
                      {item.label}
                    </div>
                    <div className="py-1">
                      {item.children.map((child) => {
                        const isActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={`block px-3 py-1.5 text-xs transition-colors ${
                              isActive
                                ? 'bg-black/35 text-white font-semibold border-l-2 border-white'
                                : 'text-rose-100 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Opción de Enlace Directo
          const isActive = pathname === item.href;
          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => collapsed && setHoveredGroup(item.id)}
              onMouseLeave={() => collapsed && setHoveredGroup(null)}
            >
              <Link
                href={item.href!}
                onClick={onClose}
                className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-black/30 text-white border-l-4 border-white font-semibold shadow-inner'
                    : 'text-rose-100 hover:bg-black/20 hover:text-white'
                } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
              </Link>

              {/* Tooltip simple en modo Colapsado para enlace directo */}
              {collapsed && hoveredGroup === item.id && (
                <div
                  className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-[#730202] border border-white/20 rounded shadow-xl text-xs font-medium text-white whitespace-nowrap z-50 pointer-events-none"
                >
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer del Sidebar con botón de expandir si está colapsado */}
      <div className="p-3 border-t border-[#730202] bg-black/10 flex items-center justify-between">
        <div className={`overflow-hidden ${collapsed ? 'lg:hidden' : 'block'}`}>
          <p className="text-[11px] text-rose-200/80 font-medium truncate">
            ERP CIP Cusco v2.0
          </p>
          <p className="text-[10px] text-rose-200/60 truncate">
            {rol || 'Usuario'}
          </p>
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex p-1.5 rounded hover:bg-black/20 text-rose-200 hover:text-white transition-colors ${
              collapsed ? 'w-full justify-center' : ''
            }`}
            title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
