'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import ConfirmCenterMessage from '@/components/common/ConfirmCenterMessage';
import ModalCambioPasswordObligatorio from '@/components/auth/ModalCambioPasswordObligatorio';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userRol, setUserRol] = useState<string | null>(null);
  const [userModulos, setUserModulos] = useState<string[] | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Cargar estado inicial y preferencias de localStorage
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/');
      return;
    }
    setAuthorized(true);

    try {
      const storedCollapsed = localStorage.getItem('sidebar_collapsed');
      if (storedCollapsed !== null) {
        setCollapsed(storedCollapsed === 'true');
      }

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setUserRol(u.rol || null);
        if (Array.isArray(u.modulos)) setUserModulos(u.modulos);
        if (u.debeCambiarPassword === true) {
          setMustChangePassword(true);
        }
      }
    } catch {}

    const handleAuthUpdated = () => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          setUserRol(u.rol || null);
          if (Array.isArray(u.modulos)) setUserModulos(u.modulos);
          if (u.debeCambiarPassword === true) {
            setMustChangePassword(true);
          } else {
            setMustChangePassword(false);
          }
        }
      } catch {}
    };

    window.addEventListener('auth-updated', handleAuthUpdated);
    window.addEventListener('storage', handleAuthUpdated);
    return () => {
      window.removeEventListener('auth-updated', handleAuthUpdated);
      window.removeEventListener('storage', handleAuthUpdated);
    };
  }, [router]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Verificación de acceso al módulo según permisos del rol
  const getRequiredModule = (path: string): string | null => {
    if (path === '/dashboard') return 'dashboard';
    const match = path.match(/^\/dashboard\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const requiredModule = getRequiredModule(pathname);
  const isModuleAllowed = (() => {
    if (!authorized) return false;
    if (!requiredModule) return true;
    if (userRol === 'ADMINISTRADOR' || userRol === 'SUPER_ADMINISTRADOR') return true;
    if (Array.isArray(userModulos)) {
      return userModulos.includes(requiredModule);
    }
    // Si aún no están cargados los módulos, permitir visualización mientras se sincroniza
    return true;
  })();

  if (!authorized) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-bg-layout"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
        }}
      >
        <svg
          className="animate-spin w-8 h-8 text-primary"
          width="32"
          height="32"
          style={{ width: '32px', height: '32px', color: '#8f0404' }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-layout">
      <Header
        onMenuClick={() => setMobileOpen(true)}
        onToggleCollapse={toggleCollapse}
        isCollapsed={collapsed}
      />
      <ConfirmCenterMessage />
      <ModalCambioPasswordObligatorio
        isOpen={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
        <main className="flex-1 flex flex-col min-w-0 lg:overflow-hidden bg-[#F8FAFC]">
          <Breadcrumbs />
          <div className="flex-1 lg:overflow-y-auto p-3 sm:p-4 lg:p-6">
            {!isModuleAllowed ? (
              <div className="max-w-xl mx-auto my-12 bg-white border border-[#E2E8F0] rounded-lg p-8 shadow-sm text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-amber-600">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#1E293B]">Módulo no Habilitado</h2>
                <p className="text-sm text-[#64748B] mt-2">
                  Su rol actual (<span className="font-semibold text-[#8f0404]">{userRol || 'Usuario'}</span>) no cuenta con permisos activos para acceder al módulo{' '}
                  <span className="font-semibold text-[#1E293B] font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                    {requiredModule}
                  </span>.
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Si necesita acceder a esta funcionalidad, solicite al Administrador del Sistema la activación del módulo en el panel de Roles.
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-white text-sm font-medium transition-colors shadow-sm"
                  style={{ backgroundColor: '#8f0404' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Volver al Dashboard Principal
                </button>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
