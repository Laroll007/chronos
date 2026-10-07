// Lot « rangement » (1.16) : compteurs proposés selon le régime, et conseils
// RTC → CET calculés selon le cycle (plus de « 83h30 » figé).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CycleConfig } from '../types';
import { DEFAULT_CYCLE_CONFIG } from '../storage';
import { conseilRTCCET } from '../calculations';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));

import { CountersSetup, EMPTY_COUNTERS } from '@/components/onboarding/CountersSetup';
import { helpContent } from '@/components/shared/CounterHelpModal';

afterEach(cleanup);

const cycle = (patch: Partial<CycleConfig>): CycleConfig => ({ ...DEFAULT_CYCLE_CONFIG, ...patch });
const CYCLE_12H08 = cycle({ type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: 12 * 60 + 8 });
const CYCLE_11H08 = cycle({ type: 'alterne', pattern: '3/3', heuresParJour: 11 * 60 + 8 });
const CYCLE_4_2 = cycle({ type: 'alterne', pattern: '4/2', heuresParJour: 8 * 60 + 10 });
const HEBDO = cycle({ type: 'hebdo' });

describe('conseilRTCCET', () => {
  it('12h08 : 10 jours (83h30), 37h50 gagnées', () => {
    expect(conseilRTCCET(CYCLE_12H08)).toEqual({ jours: 10, minutes: 5010, gainParJour: 227, gainTotal: 2270 });
  });

  it('11h08 : 6 jours (50h06), 2h47 gagnées par jour', () => {
    const c = conseilRTCCET(CYCLE_11H08);
    expect(c.jours).toBe(6);
    expect(c.minutes).toBe(6 * 501);
    expect(c.gainParJour).toBe(167);
  });

  it('4/2 (8h10) : 5 jours, aucun gain d’heures', () => {
    const c = conseilRTCCET(CYCLE_4_2);
    expect(c.jours).toBe(5);
    expect(c.gainTotal).toBe(0);
  });
});

describe('aide des compteurs selon le cycle', () => {
  it('RTC à 11h08 : conseille 6 jours (50h06), pas 83h30', () => {
    const aide = helpContent('rtc', CYCLE_11H08)!;
    const texte = [...aide.bullets, aide.tip].join(' ');
    expect(texte).toContain('6 jours de RTC (50h06)');
    expect(texte).not.toContain('83h30');
  });

  it('CA en 4/2 : 23 jours', () => {
    expect(helpContent('ca', CYCLE_4_2)!.bullets[0]).toBe('23 jours par an pour votre cycle.');
  });

  it('sans cycle : texte générique inchangé', () => {
    expect(helpContent('rtc')!.tip).not.toContain('83h30');
  });
});

describe('liste des compteurs selon le régime', () => {
  const ouvrir = (cycleConfig: CycleConfig, initialCounters = EMPTY_COUNTERS, preselection = false) =>
    render(
      <CountersSetup
        cycleConfig={cycleConfig}
        onNext={vi.fn()}
        onBack={vi.fn()}
        skipIntro
        initialCounters={initialCounters}
        preselection={preselection}
      />
    );

  it('en cycle : RTC et CF proposés, RTT et ARTT repliés sous « Autres compteurs »', () => {
    ouvrir(CYCLE_12H08);
    expect(screen.getByLabelText(/^RTC/)).toBeTruthy();
    expect(screen.getByLabelText(/Crédits Fériés/)).toBeTruthy();
    expect(screen.queryByLabelText(/^RTT/)).toBeNull();
    expect(screen.queryByLabelText(/^ARTT/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Autres compteurs/ }));
    expect(screen.getByLabelText(/^RTT/)).toBeTruthy();
    expect(screen.getByLabelText(/^ARTT/)).toBeTruthy();
  });

  it('en hebdo : RTT et ARTT proposés, RTC et CF repliés', () => {
    ouvrir(HEBDO);
    expect(screen.getByLabelText(/^RTT/)).toBeTruthy();
    expect(screen.queryByLabelText(/^RTC/)).toBeNull();
    expect(screen.queryByLabelText(/Crédits Fériés/)).toBeNull();
  });

  it('un compteur d’un autre régime déjà actif reste visible', () => {
    ouvrir(CYCLE_12H08, { ...EMPTY_COUNTERS, hasRTT: true, rtt: 4 }, true);
    expect((screen.getByLabelText(/^RTT/) as HTMLInputElement).checked).toBe(true);
  });
});
