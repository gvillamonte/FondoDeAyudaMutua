'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  nombreCompleto: string;
  rol: string;
  email: string;
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
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
    <header className="bg-primary text-white px-6 py-3 flex items-center justify-between shadow-md">
      <div>
        <h1 className="text-lg font-semibold">Sistema de Beneficios Colegiales</h1>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="text-right">
              <p className="text-sm font-medium">{user.nombreCompleto}</p>
              <p className="text-xs text-blue-200">{getRolLabel(user.rol)}</p>
            </div>
            <div className="w-8 h-8 bg-primary-dark rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
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
              className="text-sm text-blue-200 hover:text-white transition-colors"
              title="Cerrar sesión"
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
