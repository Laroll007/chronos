import { describe, it, expect } from 'vitest';
import { repartirSurJours } from '../repartition';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const NUIT = h(12, 8);

describe('Répartition d’une pose en heures', () => {
  it('une nuit moitié RTC, moitié RPS (7h35 + 4h33)', () => {
    const r = repartirSurJours([{ type: 'rtc', amount: h(7, 35) }, { type: 'rps', amount: h(4, 33) }], [NUIT]);
    expect(r).toEqual({
      ok: true,
      tranches: [
        { type: 'rtc', amount: h(7, 35), debut: 0, fin: 0 },
        { type: 'rps', amount: h(4, 33), debut: 0, fin: 0 },
      ],
    });
  });

  it('7h de RTC complétées par 5h08 de RPS', () => {
    const r = repartirSurJours([{ type: 'rtc', amount: h(7) }, { type: 'rps', amount: h(5, 8) }], [NUIT]);
    expect(r.ok).toBe(true);
  });

  it('heures manquantes ou en trop : refus, avec l’écart', () => {
    expect(repartirSurJours([{ type: 'rtc', amount: h(7) }], [NUIT])).toEqual({ ok: false, ecart: h(5, 8), raison: 'incomplet' });
    expect(repartirSurJours([{ type: 'rtc', amount: h(13) }], [NUIT])).toEqual({ ok: false, ecart: -h(0, 52), raison: 'excedent' });
  });

  it('plusieurs jours : CA en journées entières d’abord, puis les heures à cheval', () => {
    // 3 jours : 1 CA + 7h RTC + 17h16 de RPS (= 5h08 du 2e jour + 12h08 du 3e)
    const r = repartirSurJours(
      [{ type: 'rtc', amount: h(7) }, { type: 'ca', amount: 1 }, { type: 'rps', amount: h(17, 16) }],
      [NUIT, NUIT, NUIT]
    );
    expect(r.ok && r.tranches).toEqual([
      { type: 'ca', amount: 1, debut: 0, fin: 0 },
      { type: 'rtc', amount: h(7), debut: 1, fin: 1 },
      { type: 'rps', amount: h(17, 16), debut: 1, fin: 2 },
    ]);
  });

  it('jours de durées différentes (hebdo : vendredi court)', () => {
    const r = repartirSurJours([{ type: 'ca', amount: 1 }, { type: 'rtc', amount: h(7, 25) }], [h(7, 53), h(7, 25)]);
    expect(r.ok && r.tranches[1]).toMatchObject({ debut: 1, fin: 1 });
  });

  it('plus de CA que de jours : refus', () => {
    expect(repartirSurJours([{ type: 'ca', amount: 2 }], [NUIT])).toMatchObject({ ok: false, raison: 'jours' });
  });
});
