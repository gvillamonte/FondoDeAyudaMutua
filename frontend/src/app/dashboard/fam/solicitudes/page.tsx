'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SolicitudesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/fam/registro?tab=historial'); }, [router]);
  return null;
}
