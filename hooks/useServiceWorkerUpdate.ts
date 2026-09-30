'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const POLLING_INTERVAL = 60 * 60 * 1000; // 60 minutes
// Au retour au premier plan, on revérifie si la dernière vérification date d'au
// moins ça : une PWA mobile reste suspendue des heures sans jamais naviguer.
const RESUME_CHECK_INTERVAL = 15 * 60 * 1000;
// Filet de sécurité après SKIP_WAITING : on recharge même sans `controllerchange`.
export const RELOAD_FALLBACK_MS = 3000;

/**
 * Applique la mise à jour demandée par l'utilisateur. Se termine TOUJOURS par un
 * rechargement : avant, le clic ne faisait rien dans deux cas —
 *  - la nouvelle version était déjà active (activée entre-temps par la fermeture
 *    de l'app, un autre onglet ou le raccourci /stats) : plus de SW « en
 *    attente », mais la bannière restait affichée ;
 *  - Safari (PWA iOS) n'émettait pas `controllerchange` après skipWaiting.
 */
export function applyServiceWorkerUpdate(
  registration: Pick<ServiceWorkerRegistration, 'waiting'> | null,
  reload: () => void,
  schedule: (fn: () => void, ms: number) => unknown = setTimeout
): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    reload();
    return;
  }
  waiting.postMessage({ type: 'SKIP_WAITING' });
  // `controllerchange` recharge normalement avant ce délai.
  schedule(reload, RELOAD_FALLBACK_MS);
}

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  // Reload uniquement si l'utilisateur a explicitement cliqué "Mettre à jour" :
  // sans ce flag, l'event `controllerchange` (déclenché par clients.claim() au
  // démarrage de la PWA iOS) provoque un reload en boucle.
  const userTriggeredUpdateRef = useRef(false);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  const applyUpdate = useCallback(() => {
    userTriggeredUpdateRef.current = true;
    setUpdating(true);
    applyServiceWorkerUpdate(registrationRef.current, () => window.location.reload());
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let interval: ReturnType<typeof setInterval>;
    let lastCheck = Date.now();
    const onControllerChange = () => {
      if (userTriggeredUpdateRef.current) {
        window.location.reload();
      } else {
        // Nouvelle version activée ailleurs (autre onglet, raccourci) : cette page
        // tourne encore l'ancien code. On propose de recharger — jamais d'office,
        // un rechargement automatique ici avait causé une boucle sur iOS (v1.3).
        setUpdateAvailable(true);
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const registration = registrationRef.current;
      if (!registration || Date.now() - lastCheck < RESUME_CHECK_INTERVAL) return;
      lastCheck = Date.now();
      registration.update().catch(() => undefined);
    };

    const onWaiting = () => {
      setUpdateAvailable(true);
    };

    const trackInstalling = (sw: ServiceWorker) => {
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed') {
          onWaiting();
        }
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registrationRef.current = registration;
        console.log('SW registered:', registration.scope);

        // Un SW en attente existe déjà
        if (registration.waiting) {
          onWaiting();
        }

        // Un SW en cours d'installation
        if (registration.installing) {
          trackInstalling(registration.installing);
        }

        // Écouter les futures mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            trackInstalling(newWorker);
          }
        });

        // Polling pour vérifier les mises à jour
        interval = setInterval(() => {
          lastCheck = Date.now();
          registration.update().catch(() => undefined);
        }, POLLING_INTERVAL);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });

    // Recharger automatiquement quand le nouveau SW prend le contrôle
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (interval) clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { updateAvailable, applyUpdate, dismissUpdate, dismissed, updating };
}
