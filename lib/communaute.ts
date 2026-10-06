// Communauté Discord My Chronos : lien d'invitation (permanent) et précautions,
// partagés par « Quoi de neuf ? », l'encart du planning et les Paramètres.

import { track } from './analytics';

export const LIEN_COMMUNAUTE = 'https://discord.gg/bhDaJRqEHx';

export const AVERTISSEMENT_COMMUNAUTE =
  'Reste anonyme : ne partage jamais ton nom, ton matricule, ton grade, ton service, ton lieu de travail ni de ' +
  'photo de document. Le serveur est ouvert à tous, et les messages adressés à Marco sont traités par une IA.';

/** Version courte, pour l'encart du planning. */
export const AVERTISSEMENT_COURT =
  'Reste anonyme : ni nom, ni matricule, ni service, ni lieu de travail.';

const CLE_MASQUAGE = 'chronos_communaute_masquee';

export function ouvrirCommunaute(): void {
  track('communaute_ouverte');
  // Même ouverture que le lien de soutien : navigateur externe, y compris dans l'app iPhone.
  window.open(LIEN_COMMUNAUTE, '_blank', 'noopener,noreferrer');
}

export function encartCommunauteMasque(): boolean {
  try {
    return localStorage.getItem(CLE_MASQUAGE) === '1';
  } catch {
    return false;
  }
}

export function masquerEncartCommunaute(): void {
  track('communaute_encart_masque');
  try {
    localStorage.setItem(CLE_MASQUAGE, '1');
  } catch {
    /* l'encart reviendra à la prochaine ouverture, sans gravité */
  }
}
