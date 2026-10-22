// Lieu d'affectation : il change le crédit férié et les jours fériés.
// Guide APORTT, « Crédit férié » : dotation forfaitaire 109h12, « sauf Moselle,
// Bas-Rhin, Haut-Rhin : 123h12 ; départements d'outre-mer : 116h12 »
// (Guadeloupe, Guyane, Martinique, Mayotte, La Réunion).
// Jours fériés locaux (code du travail L3133-1, L3134-13 ; loi 83-550 du
// 30 juin 1983) : Vendredi saint et 26 décembre en Alsace-Moselle ;
// commémoration de l'abolition de l'esclavage dans chaque DOM.

export type Zone = 'metropole' | 'alsace_moselle' | 'guadeloupe' | 'guyane' | 'martinique' | 'mayotte' | 'reunion' | 'autre_om';

export const ZONES: readonly { cle: Zone; label: string }[] = [
  { cle: 'metropole', label: 'Métropole' },
  { cle: 'alsace_moselle', label: 'Alsace-Moselle (57, 67, 68)' },
  { cle: 'guadeloupe', label: 'Guadeloupe' },
  { cle: 'guyane', label: 'Guyane' },
  { cle: 'martinique', label: 'Martinique' },
  { cle: 'mayotte', label: 'Mayotte' },
  { cle: 'reunion', label: 'La Réunion' },
  { cle: 'autre_om', label: 'Autre outre-mer (Polynésie, Nouvelle-Calédonie…)' },
];

const DOM: ReadonlySet<Zone> = new Set(['guadeloupe', 'guyane', 'martinique', 'mayotte', 'reunion']);

export function estZone(v: unknown): v is Zone {
  return typeof v === 'string' && ZONES.some((z) => z.cle === v);
}

export function libelleZone(zone: Zone | undefined): string {
  return ZONES.find((z) => z.cle === (zone ?? 'metropole'))!.label;
}

/** Crédit férié annuel (minutes). « Autre outre-mer » : non précisé par le guide → dotation forfaitaire. */
export function cfAnnuel(zone: Zone | undefined): number {
  if (zone === 'alsace_moselle') return 123 * 60 + 12;
  if (zone && DOM.has(zone)) return 116 * 60 + 12;
  return 109 * 60 + 12;
}

/** Crédit férié d'un semestre (moitié du crédit annuel), pour le lissage. */
export function cfParSemestre(zone: Zone | undefined): number {
  return Math.round(cfAnnuel(zone) / 2);
}

/** Commémoration de l'abolition de l'esclavage ('MM-JJ'). */
const ABOLITION: Partial<Record<Zone, string>> = {
  mayotte: '04-27',
  martinique: '05-22',
  guadeloupe: '05-27',
  guyane: '06-10',
  reunion: '12-20',
};

/**
 * Jours fériés propres à la zone, en plus des 11 nationaux. `paques` = dimanche
 * de Pâques de l'année (le Vendredi saint tombe deux jours avant).
 */
export function feriesLocaux(zone: Zone | undefined, annee: number, paques: Date): string[] {
  if (zone === 'alsace_moselle') {
    const vendrediSaint = new Date(paques.getFullYear(), paques.getMonth(), paques.getDate() - 2);
    const mm = String(vendrediSaint.getMonth() + 1).padStart(2, '0');
    const jj = String(vendrediSaint.getDate()).padStart(2, '0');
    return [`${annee}-${mm}-${jj}`, `${annee}-12-26`];
  }
  const abolition = zone ? ABOLITION[zone] : undefined;
  return abolition ? [`${annee}-${abolition}`] : [];
}
