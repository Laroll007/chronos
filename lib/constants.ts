// Constantes métier pour Chronos - Règles de gestion des congés policiers

// ============================================
// DURÉES EN MINUTES
// ============================================

// Journée de travail standard
export const HEURES_PAR_JOUR = 12 * 60 + 8; // 12h08 = 728 minutes

// ============================================
// CONGÉS ANNUELS (CA)
// ============================================
export const CA_TOTAL_ANNUEL = 18; // jours (par défaut pour cycles 12h08)
export const CA_MAX_VERS_CET = 5; // jours
export const CA_REQUIS_POUR_HP = 8; // jours à poser hors période pour obtenir CA HP
export const CA_HP_PALIER_1 = 4;   // seuil pour obtenir le 1er jour CA HP
export const CA_HP_BONUS = 2; // jours bonus si condition remplie

// CA par cycle (APORTT)
export const CA_PAR_CYCLE: Record<string, number> = {
  '4/2': 23,           // Cycle 4/2 (8h10)
  '2/2': 18,           // Cycle 2/2 (12h08)
  '3/3': 18,           // Cycle 3/3 (12h08)
  '2/2/3/2/2/3': 18,   // Cycle 2/2/3/2/2/3 (12h08)
  'vacation_forte': 18, // Vacation Forte (9h31)
};

// Cycle hebdomadaire (régime général : 5 semaines de congés)
export const CA_HEBDO = 25; // jours/an pour le cycle hebdomadaire

// ============================================
// CRÉDITS FÉRIÉS (CF)
// ============================================
export const CF_TOTAL_ANNUEL = 109 * 60 + 12; // 109h12 = 6552 minutes
export const CF_PAR_SEMESTRE = 54 * 60 + 36; // 54h36 = 3276 minutes

// ============================================
// RTC - RÉCUPÉRATION TEMPS DE CYCLE
// ============================================
export const RTC_BRUT_ANNUEL = 187 * 60 + 9; // 187h09 = 11229 minutes (brut)

// Journée de solidarité (APORTT)
export const JOURNEE_SOLIDARITE = HEURES_PAR_JOUR; // 12h08 = 728 minutes
export const RTC_NET_ANNUEL = RTC_BRUT_ANNUEL - JOURNEE_SOLIDARITE; // 175h01 = 10501 minutes

// Cycles exclus de l'abondement HS (journée solidarité)
export const CYCLES_EXCLUS_ABONDEMENT_HS = ['2/2', '3/3', '2/2/3/2/2/3', 'vacation_forte'];

// Pour compatibilité avec le code existant
export const RTC_TOTAL_ANNUEL = RTC_NET_ANNUEL; // Utilise le net par défaut
export const RTC_JOURS_ANNUELS = 15; // 15 jours + 6h09 (brut)

// Conversion RTC → CET (avantageuse)
export const RTC_COUT_PAR_JOUR_CET = 8 * 60 + 21; // 8h21 = 501 minutes pour 1 jour CET
export const RTC_VALEUR_REELLE_JOUR = HEURES_PAR_JOUR; // 12h08 = 728 minutes
export const RTC_GAIN_PAR_JOUR = RTC_VALEUR_REELLE_JOUR - RTC_COUT_PAR_JOUR_CET; // 3h47 = 227 minutes

// RTC réservés pour CET
export const RTC_MAX_JOURS_CET = 10; // jours max vers CET
export const RTC_RESERVES_CET = RTC_COUT_PAR_JOUR_CET * RTC_MAX_JOURS_CET; // 83h30 = 5010 minutes
export const RTC_GAIN_ANNUEL_TOTAL = RTC_GAIN_PAR_JOUR * RTC_MAX_JOURS_CET; // 37h50 = 2270 minutes

// RTC libres (après réserve CET)
export const RTC_LIBRES = RTC_TOTAL_ANNUEL - RTC_RESERVES_CET; // 103h39 = 6219 minutes

// ============================================
// RPS - RÉCUPÉRATION DIMANCHE
// ============================================
export const RPS_PAR_DIMANCHE = 4 * 60 + 51; // 4h51 = 291 minutes (= 12h08 × 0.4)
export const RPS_DIMANCHES_ANNUELS_ALTERNE = 26; // dimanches/an pour cycle alterné
export const RPS_ANNUEL_ESTIME = RPS_PAR_DIMANCHE * RPS_DIMANCHES_ANNUELS_ALTERNE; // 126h06 = 7566 minutes

// Coefficients RPS (APORTT) - pour référence et calculs avancés
export const COEFFICIENTS_RPS = {
  nuit: 0.1,           // Travail 21h-6h du lundi au samedi
  dimanche: 0.4,       // Travail le dimanche
  decalee_rc: 0.25,    // Prise décalée sur RC
  decalee_rl_jf: 0.60, // Prise décalée sur RL ou JF
  repos_manque: 0.15,  // Par heure de repos journalier manqué
};

// ============================================
// ARTT - AMÉNAGEMENT ET RÉDUCTION DU TEMPS DE TRAVAIL
// ============================================
export const ARTT_QUOTA_ANNUEL = 20; // jours/an (arrêté du 3 mai 2002 - police nationale)

// ============================================
// CONGÉS BONIFIÉS (décret n°2020-851 du 2 juillet 2020)
// ============================================
export const CONGES_BONIFIES_QUOTA = 31; // jours (nouveau régime post-2020)
export const CONGES_BONIFIES_QUOTA_ANCIEN = 65; // jours (régime pré-2020)
export const CONGES_BONIFIES_CYCLE_MOIS = 24; // tous les 24 mois
export const CONGES_BONIFIES_EXPIRATION_MOIS = 36; // expire 36 mois après ouverture du droit
export const CONGES_BONIFIES_REPORT_MAX_MOIS = 12; // report max : +12 mois = 48 mois max

// ============================================
// HEURES SUPPLÉMENTAIRES (HS)
// ============================================
export const HS_MAX_STOCKABLES = 160 * 60; // 160h = 9600 minutes
export const HS_MAX_VERS_CET = 5; // jours max vers CET

// HS Historique (compte gelé depuis 2020, décret 2020-1398)
export const HS_HISTORIQUE_TAUX_HORAIRE = 13.25; // €/h brut (indemnisation campagnes)

// ============================================
// CET - COMPTE ÉPARGNE TEMPS
// ============================================
export const CET_PLAFOND = 60; // jours max
export const CET_APPORT_ANNUEL_MAX = 15; // jours max par an

// ============================================
// DATES IMPORTANTES
// ============================================
export const DEADLINE_FIN_ANNEE = '12-31';
export const DEADLINE_S1 = '06-30';
export const DEADLINE_S2 = '12-31';

// Périodes CA HP
export const CA_HP_PERIODE_1_DEBUT = '01-01';
export const CA_HP_PERIODE_1_FIN = '04-30';
export const CA_HP_PERIODE_2_DEBUT = '11-01';
export const CA_HP_PERIODE_2_FIN = '12-31';

// ============================================
// LABELS ET DESCRIPTIONS
// ============================================
export const COUNTER_LABELS: Record<string, { name: string; description: string; unit: string }> = {
  ca: {
    name: 'Congés Annuels',
    description: 'Perdus au 31/12 si non utilisés. Max 5 vers CET.',
    unit: 'jours',
  },
  caHP: {
    name: 'CA Hors Période',
    description: 'Bonus si 8 CA posés hors période. Peuvent aller au CET.',
    unit: 'jours',
  },
  cf: {
    name: 'Crédits Fériés',
    description: 'Conseil : lisser ~54h36/semestre. Attribués en avance pour l\'année.',
    unit: 'heures',
  },
  rtc: {
    name: 'RTC',
    description: '83h30 à réserver pour CET. Perdus au 31/12.',
    unit: 'heures',
  },
  rtcReserves: {
    name: 'RTC Réservés CET',
    description: 'À ne PAS toucher ! Conversion avantageuse vers CET.',
    unit: 'heures',
  },
  rtcLibres: {
    name: 'RTC Libres',
    description: 'Disponibles après réserve CET. Perdus au 31/12.',
    unit: 'heures',
  },
  rtt: {
    name: 'RTT',
    description: 'Récupération Temps de Travail. Perdus au 31/12.',
    unit: 'heures',
  },
  rps: {
    name: 'RPS',
    description: 'Récupération dimanche. Gardés indéfiniment.',
    unit: 'heures',
  },
  hs: {
    name: 'Heures Sup',
    description: 'Max 160h stockables. Au-delà = paiement obligatoire.',
    unit: 'heures',
  },
  cet: {
    name: 'CET',
    description: 'Compte Épargne Temps. Plafond 60 jours.',
    unit: 'jours',
  },
  artt: {
    name: 'ARTT',
    description: '20j/an. Perdus au 31/12 si non posés. (Arrêté 3 mai 2002)',
    unit: 'jours',
  },
  caAnterieur: {
    name: 'CA Antérieurs',
    description: 'Report CA N-1. Deadline : 30 avril. Non convertibles en CET.',
    unit: 'jours',
  },
  caHPAnterieur: {
    name: 'CA HP Antérieurs',
    description: 'Report CA HP N-1. Deadline : 30 avril. Non convertibles en CET.',
    unit: 'jours',
  },
  cet2008: {
    name: 'CET 2008',
    description: 'Stock historique gelé (constitué avant 2010). Pas de deadline.',
    unit: 'jours',
  },
  congesBonifies: {
    name: 'Congés Bonifiés',
    description: '31j tous les 2 ans (DOM/TOM). Expire 36 mois après ouverture du droit.',
    unit: 'jours',
  },
  hsHistorique: {
    name: 'HS Historique',
    description: 'Stock antérieur à 2020. Récupération ou indemnisation (13,25 €/h).',
    unit: 'heures',
  },
};

// ============================================
// COULEURS PAR COMPTEUR - Palette tricolore
// ============================================
export const COUNTER_COLORS: Record<string, { gradient: string; bg: string; text: string; ring: string; glow: string }> = {
  ca: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  caHP: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  cf: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  rtc: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  rtcReserves: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  rtt: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  rps: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  hs: {
    gradient: 'from-blue-600 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  cet: {
    gradient: 'from-blue-600 to-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  artt: {
    gradient: 'from-slate-600 to-slate-500',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    ring: 'ring-slate-500/30',
    glow: 'shadow-slate-500/20',
  },
  caAnterieur: {
    gradient: 'from-amber-600 to-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-500/30',
    glow: 'shadow-amber-500/20',
  },
  caHPAnterieur: {
    gradient: 'from-orange-600 to-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    ring: 'ring-orange-500/30',
    glow: 'shadow-orange-500/20',
  },
  cet2008: {
    gradient: 'from-blue-700 to-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  congesBonifies: {
    gradient: 'from-emerald-600 to-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-500/30',
    glow: 'shadow-emerald-500/20',
  },
  hsHistorique: {
    gradient: 'from-rose-600 to-rose-500',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-500/30',
    glow: 'shadow-rose-500/20',
  },
};

// ============================================
// JOURS DE LA SEMAINE
// ============================================
export const JOURS_SEMAINE = [
  { key: 'lundi', label: 'Lundi', short: 'Lun' },
  { key: 'mardi', label: 'Mardi', short: 'Mar' },
  { key: 'mercredi', label: 'Mercredi', short: 'Mer' },
  { key: 'jeudi', label: 'Jeudi', short: 'Jeu' },
  { key: 'vendredi', label: 'Vendredi', short: 'Ven' },
  { key: 'samedi', label: 'Samedi', short: 'Sam' },
  { key: 'dimanche', label: 'Dimanche', short: 'Dim' },
] as const;

// ============================================
// VERSION APP
// ============================================
export const APP_VERSION = '1.3.0';
export const STORAGE_KEY = 'chronos_data';
