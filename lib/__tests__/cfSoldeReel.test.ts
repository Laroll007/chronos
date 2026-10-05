import { describe, it, expect } from 'vitest';
import { generateRecommendations } from '../recommendations';
import { calculateDeadlineNotifications } from '../notifications';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';

// Retour terrain : 9 CF posés, compteur à 0, l'app réclamait encore « 2 CF avant le 31/12 ».
describe('Rappels CF : jamais plus que le solde réel', () => {
  const decembre = new Date(2026, 11, 5);
  const c = { ...DEFAULT_COUNTERS, hasCF: true, cf: 0, cfConsoS1: 0, cfConsoS2: 0 };

  it('aucune recommandation CF quand le compteur est à 0', () => {
    const recos = generateRecommendations(c, DEFAULT_CYCLE_CONFIG, decembre);
    expect(recos.filter((r) => r.counterType === 'cf')).toHaveLength(0);
  });

  it('aucune notification CF de fin de semestre quand le compteur est à 0', () => {
    const notifs = calculateDeadlineNotifications(c, decembre);
    expect(notifs.filter((n) => n.counterType === 'cf')).toHaveLength(0);
  });

  it('avec un solde restant, la recommandation ne dépasse pas ce solde', () => {
    const recos = generateRecommendations({ ...c, cf: 728 }, DEFAULT_CYCLE_CONFIG, decembre);
    const cf = recos.find((r) => r.counterType === 'cf');
    expect(cf?.amountToConsume).toBe(728);
  });
});
