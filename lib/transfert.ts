// Passage de l'ancienne app Android (TWA) à l'app native : récupération des
// données restées dans le navigateur du téléphone.
//
// L'ancienne app affichait mychronos.fr dans le navigateur (Chrome, Samsung
// Internet…) : ses données sont dans CE navigateur, que l'app native ne peut pas
// lire. L'app ouvre donc mychronos.fr/transfert dans le navigateur ; la page y
// lit les données et les renvoie à l'app par le lien
// fr.mychronos.app://transfert?d=… (rien ne passe par un serveur). L'app vérifie
// le contenu et demande confirmation avant de l'enregistrer. Les données du
// navigateur ne sont jamais effacées.
//
// Format de `d` : « g1. » + gzip en base64url, ou « j1. » + JSON en base64url
// quand le navigateur ne sait pas compresser.

import { STORAGE_KEY } from './constants';
import { validateUserData } from './storage';
import type { UserData } from './types';

export const LIEN_RETOUR = 'fr.mychronos.app://transfert';
/** Page de transfert, sur le site que l'app affiche (mychronos.fr en production). */
export const pageTransfert = () => `${window.location.origin}/transfert`;
/** Au-delà, le lien risque d'être refusé : on propose le fichier de sauvegarde. */
export const TAILLE_MAX_LIEN = 1_500_000;

function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(texte: string): Uint8Array {
  const b64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

async function transformer(octets: Uint8Array, flux: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const sortie = new Response(octets as BodyInit).body!.pipeThrough(flux);
  return new Uint8Array(await new Response(sortie).arrayBuffer());
}

/** Données brutes du navigateur → paramètre `d` du lien de retour. */
export async function encoderTransfert(brut: string): Promise<string> {
  const octets = new TextEncoder().encode(brut);
  if (typeof CompressionStream === 'function') {
    try {
      return `g1.${versBase64Url(await transformer(octets, new CompressionStream('gzip')))}`;
    } catch {
      /* repli sans compression */
    }
  }
  return `j1.${versBase64Url(octets)}`;
}

/** Paramètre `d` → données brutes (JSON). Lève une erreur si illisible. */
export async function decoderTransfert(d: string): Promise<string> {
  const [format, contenu] = [d.slice(0, 3), d.slice(3)];
  if (!contenu) throw new Error('vide');
  if (format === 'j1.') return new TextDecoder().decode(depuisBase64Url(contenu));
  if (format === 'g1.') {
    const octets = await transformer(depuisBase64Url(contenu), new DecompressionStream('gzip'));
    return new TextDecoder().decode(octets);
  }
  throw new Error('format inconnu');
}

export interface ResumeTransfert {
  data: UserData;
  /** Congés posés (hors annulations). */
  poses: number;
  /** Dernière modification dans l'ancienne app (ISO), si connue. */
  derniereModif?: string;
}

/** Vérifie des données brutes et en fait le résumé affiché avant import. */
export function lireDonneesTransfert(brut: string | null): ResumeTransfert | null {
  if (!brut) return null;
  let data: unknown;
  try {
    data = JSON.parse(brut);
  } catch {
    return null;
  }
  if (!validateUserData(data)) return null;
  const history = Array.isArray(data.history) ? data.history : [];
  return {
    data,
    poses: history.filter((h) => h.action === 'pose').length,
    derniereModif: data.lastUpdated,
  };
}

/** Côté navigateur : données laissées par l'ancienne app, ou null. */
export function donneesDuNavigateur(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
