'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  colegiados: 'Colegiados',
  beneficios: 'Beneficios',
  pagos: 'Pagos',
  reportes: 'Reportes',
  'estados-habilidad': 'Estados de Habilidad',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav className="flex items-center text-sm text-text-sec py-3 px-6 bg-bg-layout border-b border-border-main">
      <Link href="/dashboard" className="hover:text-primary transition-colors">
        Inicio
      </Link>
      {segments.slice(1).map((segment, index) => {
        const isLast = index === segments.length - 2;
        const href = '/' + segments.slice(0, index + 2).join('/');
        const label = breadcrumbMap[segment] || segment;

        return (
          <span key={href} className="flex items-center">
            <span className="mx-2">/</span>
            {isLast ? (
              <span className="text-text-main font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-primary transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
