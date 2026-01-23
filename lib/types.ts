// Types fondamentaux pour Chronos - Gestion des congés policiers

export type CycleType = 'alterne' | 'hebdo';
export type WeekType = 'A' | 'B';

// Pattern de cycle - détermine le nombre de CA
export type CyclePattern =
  | '4/2'           // 23 CA
  | '2/2'           // 18 CA
  | '3/3'           // 18 CA
  | '2/2/3/2/2/3'   // 18 CA
  | 'vacation_forte'; // 18 CA (VF)

export interface WeekSchedule {
  lundi: boolean;
  mardi: boolean;
  mercredi: boolean;
  jeudi: boolean;
  vendredi: boolean;
  samedi: boolean;
  dimanche: boolean;
}

export interface CycleConfig {
  type: CycleType;
  pattern?: CyclePattern; // Pattern de cycle (4/2, 2/2, 3/3, etc.)
  heuresParJour: number; // en minutes (ex: 728 pour 12h08)
  dateDebutCycle: string; // ISO date string
  semaineActuelle: WeekType;
  semaineA: WeekSchedule;
  semaineB?: WeekSchedule; // seulement si alterné
}

export interface Counters {
  // Congés Annuels
  ca: number; // jours restants (max 18)
  caConsommes: number; // jours consommés cette année
  caPosesHorsPeriode: number; // CA posés entre 01/01-30/04 ou 01/11-31/12
  caHP: number; // 0, 1 ou 2 (CA Hors Période bonus)

  // Crédits Fériés (en minutes)
  cf: number; // total restant
  cfConsoS1: number; // consommé semestre 1
  cfConsoS2: number; // consommé semestre 2

  // RTC - Récupération Temps de Cycle (en minutes)
  rtc: number; // total restant
  rtcReservesCET: number; // 83h30 = 5010 min réservés pour CET

  // RTT - optionnel, pour cycles hebdo (en minutes)
  rtt?: number;
  hasRTT: boolean;

  // RPS - Récupération dimanche (en minutes)
  rps: number; // stock total (illimité)
  rpsAnneePrec: number; // report année précédente

  // Heures Supplémentaires (en minutes)
  hs: number; // max 160h = 9600 min

  // CET - Compte Épargne Temps
  cet: number; // jours actuels
  objectifCET: number; // objectif fin d'année

  // Journée de solidarité
  journeeSolidariteAppliquee?: boolean; // true si déduction JS appliquée sur RTC
}

export interface UserData {
  cycleConfig: CycleConfig;
  counters: Counters;
  history: HistoryEntry[];
  lastUpdated: string; // ISO date string
  isOnboarded: boolean;
}

export interface HistoryEntry {
  id: string;
  date: string; // ISO date string
  action: HistoryAction;
  type: CounterType;
  amount: number; // en minutes ou jours selon type
  description?: string;
  countersSnapshot: Partial<Counters>;
}

export type HistoryAction = 'pose' | 'credit' | 'transfer_cet' | 'correction';

export type CounterType = 'ca' | 'caHP' | 'cf' | 'rtc' | 'rtt' | 'rps' | 'hs' | 'cet';

export type AlertType = 'success' | 'warning' | 'error' | 'info';
export type AlertPriority = 'high' | 'medium' | 'low';

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  message: string;
  deadline?: string; // ISO date string
  counterType?: CounterType;
}

export interface Recommendation {
  id: string;
  priority: AlertPriority;
  action: string;
  reason: string;
  deadline?: string; // ISO date string
  counterType: CounterType;
  amountToConsume?: number; // en minutes
}

export interface SimulationResult {
  newCounters: Counters;
  alerts: Alert[];
  isValid: boolean;
  errorMessage?: string;
}

export interface CETProjection {
  apportCET: {
    rtc: number; // jours (max 10)
    caHP: number; // jours (max 2)
    ca: number; // jours (max 5)
    hs: number; // jours (max 5)
  };
  totalApport: number; // jours
  cetFinal: number; // jours
  gainNetRTC: number; // minutes gagnées via conversion RTC
  joursEconomises: number;
  joursPerdus: number;
  isOptimal: boolean;
}

export interface ExportData {
  version: string;
  exportDate: string;
  cycleConfig: CycleConfig;
  counters: Counters;
  history: HistoryEntry[];
}

// Types pour le système d'optimisation des combinaisons de congés
export interface CombinationItem {
  type: CounterType;
  amount: number; // jours travaillés
  amountMinutes?: number; // pour types heures (CF, RTC, RPS, HS)
}

export type ScoreLabel = '⭐⭐⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐' | '⭐⭐';

export interface Combination {
  id: string;
  items: CombinationItem[];
  totalDays: number; // nombre total de jours travaillés couverts
  score: number; // 0-100
  scoreLabel: ScoreLabel;
  advantages: string[]; // liste des avantages
  disadvantages: string[]; // liste des inconvénients
  impact: {
    type: CounterType;
    before: number; // valeur avant (minutes ou jours)
    after: number; // valeur après (minutes ou jours)
  }[];
  isValid: boolean;
}

// Constantes pour les valeurs par défaut
export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  lundi: false,
  mardi: false,
  mercredi: false,
  jeudi: false,
  vendredi: false,
  samedi: false,
  dimanche: false,
};

export const DEFAULT_CYCLE_ALTERNE_A: WeekSchedule = {
  lundi: false,
  mardi: false,
  mercredi: true,
  jeudi: true,
  vendredi: false,
  samedi: false,
  dimanche: false,
};

export const DEFAULT_CYCLE_ALTERNE_B: WeekSchedule = {
  lundi: true,
  mardi: true,
  mercredi: false,
  jeudi: false,
  vendredi: true,
  samedi: true,
  dimanche: true,
};
