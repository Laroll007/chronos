// Sauvegarde silencieuse hors-localStorage pour survivre aux purges navigateur.
//
// Deux mécanismes, 100% transparents pour l'utilisateur :
//  - Web / Android : on demande au navigateur de ne PAS évincer le stockage
//    automatiquement (navigator.storage.persist).
//  - iOS (Capacitor) : on recopie les données dans un fichier natif de l'app,
//    qui n'est PAS purgé par la politique des 7 jours de WebKit (elle ne touche
//    que le localStorage/IndexedDB du WKWebView, pas les fichiers de l'app).
//    Au lancement, si le localStorage a été purgé, on restaure depuis ce fichier.
//
// Tout est best-effort et silencieux : aucune erreur n'est remontée à l'UI.

import { STORAGE_KEY } from './constants';

const BACKUP_FILE = 'chronos-backup.json';

let nativeChecked = false;
let isNative = false;

/**
 * Charge paresseusement les API Capacitor Filesystem, uniquement en contexte
 * natif. Renvoie null sur le web (et donc no-op partout ailleurs).
 */
async function getNative() {
  if (typeof window === 'undefined') return null;

  if (!nativeChecked) {
    nativeChecked = true;
    try {
      const { Capacitor } = await import('@capacitor/core');
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }
  }
  if (!isNative) return null;

  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    // Directory.Library : dossier interne (invisible de l'utilisateur), non purgé
    // par WebKit, et inclus dans les sauvegardes iCloud de l'appareil.
    return { Filesystem, Directory, Encoding };
  } catch {
    return null;
  }
}

/**
 * Demande au navigateur de ne pas évincer automatiquement le stockage.
 * Web / Android uniquement (non supporté iOS, no-op silencieux).
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Recopie les données dans le fichier natif iOS. No-op sur le web.
 * À appeler en fire-and-forget après chaque écriture localStorage.
 */
export async function mirrorToNative(json: string): Promise<void> {
  const fs = await getNative();
  if (!fs) return;
  try {
    await fs.Filesystem.writeFile({
      path: BACKUP_FILE,
      data: json,
      directory: fs.Directory.Library,
      encoding: fs.Encoding.UTF8,
    });
  } catch {
    /* silencieux */
  }
}

/**
 * Supprime le miroir natif (lors d'une réinitialisation des données).
 */
export async function clearNative(): Promise<void> {
  const fs = await getNative();
  if (!fs) return;
  try {
    await fs.Filesystem.deleteFile({
      path: BACKUP_FILE,
      directory: fs.Directory.Library,
    });
  } catch {
    /* fichier déjà absent */
  }
}

/**
 * iOS : si le localStorage est vide (purge WebKit, réinstallation…) mais que le
 * miroir natif existe, restaure les données dans le localStorage. Silencieux,
 * no-op sur le web et si des données sont déjà présentes.
 */
export async function restoreFromNativeIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Des données existent déjà → rien à restaurer (sortie immédiate, sans
  // charger Capacitor : coût nul pour les utilisateurs web habituels).
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch {
    return;
  }

  const fs = await getNative();
  if (!fs) return;

  try {
    const res = await fs.Filesystem.readFile({
      path: BACKUP_FILE,
      directory: fs.Directory.Library,
      encoding: fs.Encoding.UTF8,
    });
    const data = typeof res.data === 'string' ? res.data : '';
    if (!data) return;

    // Vérifie que c'est bien du JSON avant de réinjecter (la validation
    // métier complète est faite ensuite par loadUserData()).
    JSON.parse(data);
    localStorage.setItem(STORAGE_KEY, data);
  } catch {
    /* pas de miroir, illisible ou JSON invalide → on laisse l'onboarding faire */
  }
}
