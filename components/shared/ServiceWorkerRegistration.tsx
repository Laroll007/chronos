'use client';

import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { UpdateBanner } from './UpdateBanner';

export function ServiceWorkerRegistration() {
  const { updateAvailable, applyUpdate, dismissUpdate, dismissed, updating } =
    useServiceWorkerUpdate();

  if (!updateAvailable || dismissed) return null;

  return <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} updating={updating} />;
}
