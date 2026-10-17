'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { startStats } from '@/lib/analytics';

/** Pages de l'app : elles seules comptent comme une ouverture (actif, nouvel appareil). */
const PAGES_APP = ['/dashboard', '/onboarding'];

/**
 * Démarre les statistiques anonymes (cf. lib/analytics.ts). Hors tableau de bord
 * /stats ; sur les autres pages (accueil, téléchargement, transfert…), seuls les
 * événements sont envoyés : une visite n'est pas un utilisateur de l'app.
 */
export function StatsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith('/stats')) return;
    startStats({ ouverture: PAGES_APP.some((p) => pathname?.startsWith(p)) });
  }, [pathname]);

  return null;
}
