// Absences sans effet sur les compteurs : ASA, absences syndicales, exemptions,
// repos décalé. Elles marquent le planning (le jour n'est pas travaillé, aucun
// RPS crédité) sans rien débiter. Durées et règles : guide DNPAF « Gestion du
// temps de travail » (janvier 2026). L'app ne décompte pas ces droits : les
// durées sont affichées pour information.

export type MotifAbsence =
  | 'asa_mariage'
  | 'asa_naissance'
  | 'asa_deces'
  | 'asa_maladie_grave'
  | 'asa_garde_enfant'
  | 'asa_autre'
  | 'art13'
  | 'art15'
  | 'cfs'
  | 'exn'
  | 'repos_decale';

export interface InfoMotif {
  label: string;
  /** Libellé court (liste des congés, calendrier). */
  court: string;
  /** Code GesTT, pour retrouver la ligne sur son relevé. */
  code: string;
  aide: string;
}

export const MOTIFS_ABSENCE: Record<MotifAbsence, InfoMotif> = {
  asa_mariage: {
    label: 'ASA mariage / PACS',
    court: 'Mariage/PACS',
    code: 'ASA',
    aide: 'Mariage ou PACS de l’agent : 5 jours ouvrables maximum. Mariage d’un descendant : 3 jours ; d’un parent jusqu’au 3e degré : 1 jour.',
  },
  asa_naissance: {
    label: 'Naissance ou adoption',
    court: 'Naissance',
    code: 'NAI',
    aide: '3 jours ouvrables, pris d’affilée à partir de la naissance (ou du 1er jour ouvrable qui suit). Le congé paternité (25 jours) est distinct.',
  },
  asa_deces: {
    label: 'ASA décès',
    court: 'Décès',
    code: 'ASA',
    aide: 'Conjoint (ou PACS), ascendant, descendant : 3 jours ouvrables. Parent jusqu’au 3e degré : 1 jour. Décès d’un enfant : 12 jours ouvrables (+ 8 jours de congé de deuil).',
  },
  asa_maladie_grave: {
    label: 'ASA maladie très grave',
    court: 'Maladie grave',
    code: 'ASA',
    aide: 'Maladie très grave du conjoint (ou PACS), d’un ascendant ou d’un descendant : 3 jours ouvrables maximum, sur certificat médical.',
  },
  asa_garde_enfant: {
    label: 'Garde d’enfant malade',
    court: 'Garde enfant',
    code: 'GEM',
    aide: 'Autorisations accordées par famille, quel que soit le nombre d’enfants. Le volume dépend de votre régime : vérifiez-le auprès de votre service.',
  },
  asa_autre: {
    label: 'Autre ASA',
    court: 'ASA',
    code: 'ASA',
    aide: 'Autre autorisation spéciale d’absence accordée par votre service (examen, concours, don du sang…).',
  },
  art13: {
    label: 'Art. 13 (réunion syndicale)',
    court: 'Art. 13',
    code: 'A13',
    aide: 'Une absence art. 13 posée sur un repos de cycle ne donne lieu à aucune compensation.',
  },
  art15: {
    label: 'Art. 15 (convocation de l’administration)',
    court: 'Art. 15',
    code: 'A15',
    aide: 'Sur un jour de congé, celui-ci vous est restitué ; sur un RC ou un RL, le repos est décalé sans majoration : posez-le avec « Repos décalé ».',
  },
  cfs: {
    label: 'Congé de formation syndicale (CFS)',
    court: 'CFS',
    code: 'CFS',
    aide: '12 jours ouvrables par an maximum. Un RC ou RL tombant pendant le stage est reporté, sans majoration, dès la fin du stage : posez-le avec « Repos décalé ».',
  },
  exn: {
    label: 'Exemption (EXN)',
    court: 'EXN',
    code: 'EXN',
    aide: 'Exemption de vacation, par exemple la nuit qui précède un stage pour garantir le repos minimum. Aucun compteur débité.',
  },
  repos_decale: {
    label: 'Repos décalé (RC/RL)',
    court: 'Repos décalé',
    code: 'RC/RL',
    aide: 'Un RC ou RL déplacé (Art. 15, CFS, nécessité de service) : posez-le sur le jour où vous le prenez réellement. Le jour n’est pas travaillé, sans débit de compteur.',
  },
};

export const ORDRE_MOTIFS: MotifAbsence[] = [
  'asa_mariage', 'asa_naissance', 'asa_deces', 'asa_maladie_grave', 'asa_garde_enfant', 'asa_autre',
  'art13', 'art15', 'cfs', 'exn', 'repos_decale',
];

export function estMotifAbsence(v: unknown): v is MotifAbsence {
  return typeof v === 'string' && v in MOTIFS_ABSENCE;
}
