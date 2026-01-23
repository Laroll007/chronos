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
export const CA_HP_BONUS = 2; // jours bonus si condition remplie

// CA par cycle (APORTT)
export const CA_PAR_CYCLE: Record<string, number> = {
  '4/2': 23,           // Cycle 4/2 (8h10)
  '2/2': 18,           // Cycle 2/2 (12h08)
  '3/3': 18,           // Cycle 3/3 (12h08)
  '2/2/3/2/2/3': 18,   // Cycle 2/2/3/2/2/3 (12h08)
  'vacation_forte': 18, // Vacation Forte (9h31)
};

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
// HEURES SUPPLÉMENTAIRES (HS)
// ============================================
export const HS_MAX_STOCKABLES = 160 * 60; // 160h = 9600 minutes
export const HS_MAX_VERS_CET = 5; // jours max vers CET

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
    description: 'Net après JS (brut 187h09 - 12h08). 83h30 à réserver pour CET.',
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
};

// ============================================
// COULEURS PAR COMPTEUR
// ============================================
export const COUNTER_COLORS: Record<string, { gradient: string; bg: string; text: string }> = {
  ca: {
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  caHP: {
    gradient: 'from-indigo-500 to-purple-500',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  cf: {
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  rtc: {
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  rtcReserves: {
    gradient: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  rtt: {
    gradient: 'from-lime-500 to-green-500',
    bg: 'bg-lime-50',
    text: 'text-lime-600',
  },
  rps: {
    gradient: 'from-slate-500 to-slate-600',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
  },
  hs: {
    gradient: 'from-red-500 to-orange-500',
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
  cet: {
    gradient: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
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
export const APP_VERSION = '1.0.0';
export const STORAGE_KEY = 'chronos_data';
