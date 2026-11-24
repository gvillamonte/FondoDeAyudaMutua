'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  nombreCompleto: string;
  rol: string;
  email: string;
}

export default function Header({
  onMenuClick,
  onToggleCollapse,
  isCollapsed = false,
}: {
  onMenuClick?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);

  const loadUser = () => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {}
  };

  useEffect(() => {
    loadUser();
    const handleAuthUpdate = () => loadUser();
    window.addEventListener('auth-updated', handleAuthUpdate);
    window.addEventListener('storage', handleAuthUpdate);
    return () => {
      window.removeEventListener('auth-updated', handleAuthUpdate);
      window.removeEventListener('storage', handleAuthUpdate);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignorar errores de logout
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/');
    }
  };

  const getRolLabel = (rol: string) => {
    const labels: Record<string, string> = {
      ADMINISTRADOR: 'Administrador',
      OPERADOR_PAGOS: 'Operador de Pagos',
      AUDITOR: 'Auditor',
    };
    return labels[rol] || rol;
  };

  return (
    <header className="bg-[#8f0404] border-b border-[#730202] text-white px-3 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        {/* Botón Móvil: Abrir drawer */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 -ml-1 rounded hover:bg-primary-dark transition-colors flex-shrink-0"
          aria-label="Abrir menú"
          title="Abrir menú"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Botón Desktop: Alternar colapsado/expandido */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 -ml-1 rounded hover:bg-primary-dark text-rose-100 hover:text-white transition-colors flex-shrink-0 items-center justify-center"
          aria-label={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral (más espacio de trabajo)'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
            )}
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300"></span>
          <h1 className="text-sm sm:text-lg font-bold tracking-wide truncate">Sistema ERP - Colegio de Ingenieros</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {user && (
          <>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold truncate max-w-[180px]">{user.nombreCompleto}</p>
              <p className="text-xs text-rose-200 font-medium">{getRolLabel(user.rol)}</p>
            </div>
            <div className="w-8 h-8 bg-primary-dark border border-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-white">
              <span className="text-xs font-bold">
                {user.nombreCompleto
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-rose-200 hover:text-white transition-colors p-1.5 rounded hover:bg-primary-dark"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
