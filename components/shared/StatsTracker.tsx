'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { startStats } from '@/lib/analytics';

/** Démarre les statistiques anonymes (cf. lib/analytics.ts). Hors tableau de bord /stats. */
export function StatsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith('/stats')) return;
    startStats();
  }, [pathname]);

  return null;
}
