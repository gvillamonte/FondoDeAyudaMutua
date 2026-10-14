'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfiguracionesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/configuraciones/montos-fam'); }, [router]);
  return null;
}
