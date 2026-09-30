import { describe, it, expect, vi } from 'vitest';
import { applyServiceWorkerUpdate, RELOAD_FALLBACK_MS } from '@/hooks/useServiceWorkerUpdate';

describe('« Mettre à jour » recharge toujours la page', () => {
  it('nouvelle version déjà active (plus rien en attente) : rechargement immédiat', () => {
    const reload = vi.fn();
    applyServiceWorkerUpdate({ waiting: null }, reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('pas encore enregistré : rechargement immédiat', () => {
    const reload = vi.fn();
    applyServiceWorkerUpdate(null, reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('version en attente : l’active, puis recharge même sans controllerchange (PWA iOS)', () => {
    const reload = vi.fn();
    const postMessage = vi.fn();
    const schedule = vi.fn();
    applyServiceWorkerUpdate({ waiting: { postMessage } as unknown as ServiceWorker }, reload, schedule);

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledWith(reload, RELOAD_FALLBACK_MS);

    // Le filet de sécurité recharge bien
    const [fallback] = schedule.mock.calls[0]!;
    fallback();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
