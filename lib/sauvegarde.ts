// Filet de sécurité contre les pertes de données sur Android et le web : dans
// l'app Android (TWA), les données vivent dans le navigateur du téléphone, qui
// peut les effacer (bug identifié, correction en préparation : app Android
// native). On invite à garder une sauvegarde (fichier exporté), restaurable en
// une minute, y compris dès l'écran d'inscription.

const CLE_EXPORT = 'chronos_derniere_sauvegarde';
const CLE_RAPPEL = 'chronos_rappel_sauvegarde';
const JOUR = 86_400_000;

function lire(cle: string): number {
  try {
    return Number(localStorage.getItem(cle) ?? 0);
  } catch {
    return 0;
  }
}

function ecrire(cle: string, now: number): void {
  try {
    localStorage.setItem(cle, String(now));
  } catch {
    /* ignore */
  }
}

/** Appelé après chaque export réussi. */
export function noterSauvegarde(now: number = Date.now()): void {
  ecrire(CLE_EXPORT, now);
}

/**
 * Rappel à l'ouverture (hors iPhone, qui garde une copie native) :
 * jamais sauvegardé → tous les 3 jours ; sauvegarde de plus de 30 jours →
 * au plus une fois par semaine.
 */
export function rappelSauvegardeDu(natif: boolean, now: number = Date.now()): boolean {
  if (natif) return false;
  const exporte = lire(CLE_EXPORT);
  const rappel = lire(CLE_RAPPEL);
  if (!exporte) return now - rappel >= 3 * JOUR;
  return now - exporte >= 30 * JOUR && now - rappel >= 7 * JOUR;
}

export function noterRappelSauvegarde(now: number = Date.now()): void {
  ecrire(CLE_RAPPEL, now);
}
