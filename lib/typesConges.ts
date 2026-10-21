// Types de congés : libellés courts et couleurs, partagés par la liste des
// congés et le planning (étiquette du type sur chaque jour posé).

import type { CounterType, HistoryEntry } from './types';
import { dateMatchesEntry, formatMinutes } from './calculations';
import { MOTIFS_ABSENCE, type MotifAbsence } from './absences';

export const TYPE_LABELS: Record<CounterType, { label: string; color: string }> = {
  ca: { label: 'CA', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  caHP: { label: 'CA HP', color: 'bg-red-100 text-red-700 border-red-200' },
  cf: { label: 'CF', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  rtc: { label: 'RTC', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rtt: { label: 'RTT', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  rps: { label: 'RPS', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  hs: { label: 'HS', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  cet: { label: 'CET', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  artt: { label: 'ARTT', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  caAnterieur: { label: 'CA Ant.', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  caHPAnterieur: { label: 'CA HP Ant.', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  caReporte: { label: 'CAM', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  cet2008: { label: 'CET 2008', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  congesBonifies: { label: 'Congés Bon.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  hsHistorique: { label: 'HS Hist.', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  cmo: { label: 'CMO', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  astreinte: { label: 'Astreinte', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  absence: { label: 'Absence', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

/**
 * Étiquette du type de congé d'un jour, pour le planning : « CA », « CF + HS »,
 * « CA +2 » au-delà de deux compteurs, « RTC 4h » pour des heures posées sur un
 * jour travaillé. null si rien n'est posé ce jour-là.
 */
export function etiquetteCongeDuJour(date: Date, history: HistoryEntry[]): { texte: string; couleur: string } | null {
  const poses = history.filter((e) => dateMatchesEntry(date, e, 'pose'));
  if (poses.length === 0) return null;
  const types: CounterType[] = [];
  for (const p of poses) if (!types.includes(p.type)) types.push(p.type);
  const libelle = (t: CounterType) => TYPE_LABELS[t]?.label ?? t.toUpperCase();
  const couleur = TYPE_LABELS[types[0]!]?.color ?? TYPE_LABELS.ca.color;

  // Heures posées sur un jour travaillé (pose fractionnée), sans journée entière
  if (poses.every((p) => p.partialDay)) {
    const minutes = poses.reduce((s, p) => s + p.amount, 0);
    // « 4h » plutôt que « 4h00 » : la case est petite
    const duree = minutes % 60 === 0 ? `${minutes / 60}h` : formatMinutes(minutes);
    return { texte: `${types.map(libelle).join(' + ')} ${duree}`, couleur };
  }
  const texte = types.length <= 2 ? types.map(libelle).join(' + ') : `${libelle(types[0]!)} +${types.length - 1}`;
  return { texte, couleur };
}

/**
 * Étiquette d'un jour du planning, même priorité que la couleur de la case :
 * congé posé (ou heures) > arrêt maladie > astreinte > absence (code GesTT du
 * motif : ASA, NAI, GEM…). Avec ces étiquettes, la légende n'est plus utile.
 */
export function etiquetteDuJour(date: Date, history: HistoryEntry[]): { texte: string; couleur: string } | null {
  const conge = etiquetteCongeDuJour(date, history);
  if (conge) return conge;
  const arret = history.find((e) => dateMatchesEntry(date, e, 'cmo'));
  if (arret) return { texte: arret.imputableService ? 'BS' : 'CMO', couleur: TYPE_LABELS.cmo.color };
  if (history.some((e) => dateMatchesEntry(date, e, 'astreinte'))) return { texte: 'Astreinte', couleur: TYPE_LABELS.astreinte.color };
  // Journée entière d'abord, sinon absence en heures (élu : « CME 3h »).
  const absences = history.filter((e) => dateMatchesEntry(date, e, 'absence'));
  const absence = absences.find((e) => !e.partialDay) ?? absences[0];
  if (absence) {
    const motif = absence.motif && absence.motif in MOTIFS_ABSENCE ? MOTIFS_ABSENCE[absence.motif as MotifAbsence] : null;
    const code = motif?.code ?? 'Absence';
    if (absence.partialDay) {
      const m = absence.amount;
      return { texte: `${code} ${m % 60 === 0 ? `${m / 60}h` : formatMinutes(m)}`, couleur: TYPE_LABELS.absence.color };
    }
    return { texte: code, couleur: TYPE_LABELS.absence.color };
  }
  return null;
}
