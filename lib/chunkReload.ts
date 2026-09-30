// Fichier JS introuvable après un déploiement (ChunkLoadError).
//
// Une app restée ouverte pendant une mise à jour demande, en changeant d'écran,
// un morceau de code de l'ancienne version que le serveur ne sert plus : React
// affichait alors « Une erreur est survenue » (6 cas le 30/09, jour de 6
// déploiements). Recharger la page récupère simplement la nouvelle version.

const KEY = 'chronos_chunk_reload';
/** Pas de second rechargement automatique dans cet intervalle (anti-boucle). */
const ANTI_BOUCLE_MS = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === 'ChunkLoadError') return true;
  return (
    typeof message === 'string' &&
    /Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      message
    )
  );
}

/**
 * Recharge une fois pour récupérer la nouvelle version. Retourne false si un
 * rechargement vient déjà d'avoir lieu (le fichier manque vraiment : on laisse
 * l'écran d'erreur plutôt que de boucler).
 */
export function reloadForNewVersion(
  now: number = Date.now(),
  reload: () => void = () => window.location.reload()
): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < ANTI_BOUCLE_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    /* sessionStorage indisponible : on recharge quand même, une fois */
  }
  reload();
  return true;
}
