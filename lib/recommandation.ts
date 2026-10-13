// Faire connaître My Chronos : recommandation à un collègue (partage du
// téléphone, lien unique, QR code) et demande d'avis dans les stores.
//
// Règles des stores : sur iPhone, la demande d'avis passe OBLIGATOIREMENT par
// la fenêtre native d'Apple (guideline 5.6.1 : pas d'invite maison) ; Google
// interdit de poser une question (« vous aimez l'app ? ») avant de proposer la
// note. Sur Android et le web, l'invitation est donc neutre, sans filtre.

import { Capacitor } from '@capacitor/core';
import { detectPlatform, track } from './analytics';
import type { HistoryEntry } from './types';

/** Lien unique : renvoie vers l'App Store ou le Play Store selon le téléphone. */
export const LIEN_TELECHARGER = 'https://mychronos.fr/telecharger';
export const APP_STORE = 'https://apps.apple.com/app/id6762043430';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=fr.mychronos.app';

export const MESSAGE_RECOMMANDATION =
  'Je te conseille My Chronos, l’appli gratuite pour gérer nos congés APORTT (CA, RTC, CET, prévisionnel…) ' +
  'sans rien perdre :';

export type Plateforme = 'ios' | 'android' | 'web';

export function plateforme(): Plateforme {
  const p = detectPlatform();
  return p === 'ios' ? 'ios' : p === 'android' ? 'android' : 'web';
}

/**
 * Ouvre le partage du téléphone. Renvoie false s'il n'existe pas (ordinateur) :
 * l'appelant affiche alors le lien, le QR code, WhatsApp et SMS.
 */
export async function partagerApp(): Promise<boolean> {
  track('partage_ouvert');
  const contenu = { title: 'My Chronos', text: MESSAGE_RECOMMANDATION, url: LIEN_TELECHARGER };
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ ...contenu, dialogTitle: 'Recommander My Chronos' });
      track('partage_envoye');
      return true;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(contenu);
      track('partage_envoye');
      return true;
    }
  } catch (err) {
    // Partage annulé par l'agent : rien à faire, ce n'est pas une erreur.
    if (err instanceof Error && /abort|cancel/i.test(`${err.name} ${err.message}`)) return true;
  }
  return false;
}

export const lienWhatsApp = () => `https://wa.me/?text=${encodeURIComponent(`${MESSAGE_RECOMMANDATION} ${LIEN_TELECHARGER}`)}`;
export const lienSMS = () => `sms:?&body=${encodeURIComponent(`${MESSAGE_RECOMMANDATION} ${LIEN_TELECHARGER}`)}`;

/** Fiche du store où laisser un avis (null sur le web : pas de store). */
export function lienAvisStore(p: Plateforme = plateforme()): string | null {
  if (p === 'ios') return `${APP_STORE}?action=write-review`;
  if (p === 'android') return PLAY_STORE;
  return null;
}

export function ouvrirFicheStore(): void {
  const lien = lienAvisStore();
  if (!lien) return;
  track('avis_store_ouvert');
  window.open(lien, '_blank', 'noopener,noreferrer');
}

/** iPhone : fenêtre d'avis native d'Apple (Apple décide de l'afficher, 3 fois par an au plus). */
export async function demanderAvisNatif(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch {
    /* indisponible : sans gravité */
  }
}

// ─── Quand demander un avis ─────────────────────────────────────────────────

const CLE_AVIS = 'chronos_avis_demande';
const POSES_MIN = 3;
const ANCIENNETE_MIN_MS = 7 * 86_400_000;
const INTERVALLE_MS = 120 * 86_400_000;

/**
 * Après un « moment positif » (congés posés, épargne CET), seulement pour un
 * agent qui utilise vraiment l'app : au moins 3 poses, inscrit depuis une
 * semaine, et pas plus d'une demande tous les 4 mois.
 */
export function peutDemanderAvis(history: HistoryEntry[], dateInscription: string | undefined, now: Date = new Date()): boolean {
  if (history.filter((e) => e.action === 'pose').length < POSES_MIN) return false;
  const premiere = dateInscription
    ? new Date(`${dateInscription}T00:00:00`).getTime()
    : Math.min(...history.map((e) => new Date(e.date).getTime()), now.getTime());
  if (now.getTime() - premiere < ANCIENNETE_MIN_MS) return false;
  try {
    const derniere = Number(localStorage.getItem(CLE_AVIS) ?? 0);
    return now.getTime() - derniere >= INTERVALLE_MS;
  } catch {
    return false;
  }
}

export function noterDemandeAvis(now: Date = new Date()): void {
  try {
    localStorage.setItem(CLE_AVIS, String(now.getTime()));
  } catch {
    /* ignore */
  }
}
