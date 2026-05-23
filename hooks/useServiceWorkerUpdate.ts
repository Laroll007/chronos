'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const POLLING_INTERVAL = 60 * 60 * 1000; // 60 minutes

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
    const waiting = registrationRef.current?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let interval: ReturnType<typeof setInterval>;
    const onControllerChange = () => {
      if (userTriggeredUpdateRef.current) {
        window.location.reload();
      }
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
          registration.update();
        }, POLLING_INTERVAL);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });

    // Recharger automatiquement quand le nouveau SW prend le contrôle
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      if (interval) clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return { updateAvailable, applyUpdate, dismissUpdate, dismissed };
}
