'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '@/lib/constants';
import { apiUrl, plateformeNative } from '@/lib/api';
import { compareVersions } from '@/lib/releaseNotes';
import { APP_STORE } from '@/lib/recommandation';
import { track } from '@/lib/analytics';
import { UpdateBanner } from './UpdateBanner';

const CLE = 'chronos_maj_ios_ignoree';

/**
 * App iPhone : sans mise à jour automatique, un agent peut rester des mois sur
 * une ancienne version. Au lancement, on compare la version installée à celle
 * de l'App Store ; si elle est plus ancienne, un bandeau propose d'y aller.
 * Jamais bloquant ; « fermer » vaut jusqu'à la version suivante.
 */
export function MiseAJourIOS() {
  const [maj, setMaj] = useState<{ version: string; note?: string } | null>(null);

  useEffect(() => {
    // iPhone seulement : l'app Android charge le site en ligne, déjà à jour.
    if (plateformeNative() !== 'ios') return;
    let annule = false;
    fetch(apiUrl('/api/version'))
      .then((r) => r.json())
      .then((j: { ios?: { version: string; note?: string } | null }) => {
        const ios = j.ios;
        if (annule || !ios || compareVersions(ios.version, APP_VERSION) <= 0) return;
        try {
          if (localStorage.getItem(CLE) === ios.version) return;
        } catch {
          /* ignore */
        }
        setMaj(ios);
      })
      .catch(() => {
        /* hors ligne : on réessaiera au prochain lancement */
      });
    return () => {
      annule = true;
    };
  }, []);

  if (!maj) return null;
  return (
    <UpdateBanner
      detail={maj.note ? `Nouveauté : ${maj.note}` : `Version ${maj.version} sur l’App Store`}
      onUpdate={() => {
        track('maj_ios_ouverte');
        window.open(APP_STORE, '_blank', 'noopener,noreferrer');
        setMaj(null);
      }}
      onDismiss={() => {
        try {
          localStorage.setItem(CLE, maj.version);
        } catch {
          /* ignore */
        }
        setMaj(null);
      }}
    />
  );
}
