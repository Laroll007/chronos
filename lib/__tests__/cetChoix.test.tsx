// « Mon épargne CET » ligne par ligne : demi-journées cumulables entre
// compteurs, versement choisi (au-delà de la capacité : payé ou RAFP), et les
// deux boutons de remplissage.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Counters, UserData } from '../types';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import {
  joursCETDepuisMinutes,
  minutesPourJoursCET,
  remplirMaximum,
  remplirSansPaiement,
  repartirApportCET,
} from '../cet';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));

import { CETPlanModal } from '@/components/dashboard/CETPlanModal';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const h = (hh: number, mm = 0) => hh * 60 + mm;
const compteurs = (patch: Partial<Counters>): Counters => ({
  ...DEFAULT_COUNTERS,
  ca: 0,
  caHP: 0,
  rtc: 0,
  hs: 0,
  cet: 0,
  ...patch,
});

describe('Demi-journées (guide : « cumuler des ½ journées, de natures différentes »)', () => {
  it('une demi-journée = 4h11 au moins', () => {
    expect(joursCETDepuisMinutes(h(4, 27))).toBe(0.5);
    expect(joursCETDepuisMinutes(h(4, 10))).toBe(0);
    expect(joursCETDepuisMinutes(h(12, 48))).toBe(1.5);
    expect(minutesPourJoursCET(1.5)).toBe(h(8, 21) + h(4, 11));
  });

  it('4h27 de RTC + 4h20 d’HS = 1 jour de CET', () => {
    const { maximum, conseille } = repartirApportCET(compteurs({ rtc: h(4, 27), hs: h(4, 20) }));
    expect(maximum).toMatchObject({ rtc: 0.5, hs: 0.5, total: 1 });
    expect(conseille).toMatchObject({ rtc: 0.5, hs: 0.5, total: 1 });
  });

  it('4h27 de RTC + 3h54 d’HS : pas de jour (3h54 < une demi-journée)', () => {
    const { maximum } = repartirApportCET(compteurs({ rtc: h(4, 27), hs: h(3, 54) }));
    expect(maximum.total).toBe(0.5);
    expect(remplirMaximum(maximum).total).toBe(0);
  });
});

describe('Remplissage automatique', () => {
  // CET à 10 j : il garde 15 j de plus. 5 CA, 2 CA HP, 15 j de RTC, 1 j d'HS = 23 j.
  const c = compteurs({ cet: 10, ca: 8, caHP: 2, rtc: 15 * h(8, 21), hs: h(9) });

  it('« sans me faire payer » : remplit les 15 j, RTC d’abord', () => {
    const { maximum, capacite } = repartirApportCET(c);
    expect(capacite).toBe(15);
    expect(remplirSansPaiement(maximum, capacite)).toMatchObject({ rtc: 15, ca: 0, caHP: 0, hs: 0, total: 15 });
  });

  it('« en me faisant payer » : tout, 23 j dont 8 payés ou RAFP', () => {
    const { maximum, capacite } = repartirApportCET(c);
    const tout = remplirMaximum(maximum);
    expect(tout).toMatchObject({ rtc: 15, ca: 5, caHP: 2, hs: 1, total: 23 });
    expect(tout.total - capacite).toBe(8);
  });

  it('le choix de l’agent est retenu, même au-delà de la capacité', () => {
    const choisi = repartirApportCET({ ...c, choixCET: { annee: 2026, rtc: 15, ca: 5, caHP: 2, artt: 0, rtt: 0, hs: 1 } }, 2026);
    expect(choisi.choisi).toBe(true);
    expect(choisi.apport.total).toBe(23);
    // Un choix d'une autre année est ignoré
    expect(repartirApportCET({ ...c, choixCET: { annee: 2025, rtc: 1, ca: 0, caHP: 0, artt: 0, rtt: 0, hs: 0 } }, 2026).choisi).toBe(false);
  });
});

describe('Écran « Mon épargne CET »', () => {
  const userData = (counters: Counters): UserData =>
    ({ cycleConfig: DEFAULT_CYCLE_CONFIG, counters, history: [], lastUpdated: '', lastResetYear: 2026, isOnboarded: true }) as UserData;

  it('les deux boutons enregistrent le versement choisi', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 11));
    const onUpdate = vi.fn();
    const c = compteurs({ cet: 10, ca: 8, caHP: 2, rtc: 15 * h(8, 21), hs: h(9) });
    render(<CETPlanModal userData={userData(c)} onClose={vi.fn()} onRecord={vi.fn()} onUpdateCounters={onUpdate} />);
    expect(screen.getByText(/15 j : le maximum que votre CET accepte cette année/)).toBeTruthy();
    expect(screen.getByText(/23 j : 15 sur votre CET, 8 payés ou versés à la RAFP/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Épargner le max en me faisant payer/ }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      choixCET: { annee: 2026, rtc: 15, artt: 0, rtt: 0, caHP: 2, ca: 5, hs: 1 },
      rtcJoursCET: 15,
      hsJoursCET: 1,
      caReservesCET: 5,
    });

    fireEvent.click(screen.getByRole('button', { name: /Épargner le max sans me faire payer/ }));
    expect(onUpdate.mock.lastCall![0].choixCET).toMatchObject({ rtc: 15, ca: 0, caHP: 0, hs: 0 });
  });

  it('versement choisi au-delà de la capacité : répartition affichée', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 11));
    const c = compteurs({
      cet: 10, ca: 8, caHP: 2, rtc: 15 * h(8, 21), hs: h(9),
      choixCET: { annee: 2026, rtc: 15, ca: 5, caHP: 2, artt: 0, rtt: 0, hs: 1 },
    });
    render(<CETPlanModal userData={userData(c)} onClose={vi.fn()} onRecord={vi.fn()} onUpdateCounters={vi.fn()} />);
    expect(screen.getByText(/15 j restent sur votre CET/)).toBeTruthy();
    expect(screen.getByText(/8 j au-delà : payés ou versés à la RAFP/)).toBeTruthy();
    expect(screen.getByText(/Votre CET après versement/).textContent).toContain('25 j');
  });
});
