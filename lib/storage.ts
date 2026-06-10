// LocalStorage helpers pour Chronos

import { UserData, Counters, CycleConfig, HistoryEntry, ExportData } from './types';
import { STORAGE_KEY, APP_VERSION, HEURES_PAR_JOUR, RTC_RESERVES_CET, RTC_NET_ANNUEL, JOURNEE_SOLIDARITE } from './constants';
import {
  DEFAULT_WEEK_SCHEDULE,
  DEFAULT_CYCLE_ALTERNE_A,
  DEFAULT_CYCLE_ALTERNE_B,
  DEFAULT_HEBDO_HEURES,
} from './types';
import { validateUserData as nativeValidateUserData, validateExportData } from './validation';
import { ChronosError, logger } from './errors';

// ============================================
// DONNÉES PAR DÉFAUT
// ============================================

export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  type: 'alterne',
  pattern: '2/2/3/2/2/3', // Pattern par défaut pour cycle 12h08
  heuresParJour: HEURES_PAR_JOUR,
  dateDebutCycle: '2026-01-19', // Lundi 19 janvier 2026 = début semaine B confirmée
  semaineActuelle: 'B', // Semaine B = Lu-Ma travail, Me-Je repos, Ve-Sa-Di travail
  semaineA: DEFAULT_CYCLE_ALTERNE_A,
  semaineB: DEFAULT_CYCLE_ALTERNE_B,
};

export const DEFAULT_COUNTERS: Counters = {
  ca: 18,
  caConsommes: 0,
  caPosesHorsPeriode: 0,
  caHP: 0,
  cf: 6552, // 109h12 en minutes
  cfConsoS1: 0,
  cfConsoS2: 0,
  hasCF: true,
  rtc: 11229, // 187h09 en minutes (brut, l'utilisateur choisit s'il déduit la JS)
  rtcReservesCET: RTC_RESERVES_CET,
  hasRTC: true,
  hasRTT: false,
  rtt: undefined,
  rps: 0,
  rpsAnneePrec: 0,
  hs: 0,
  cet: 0,
  objectifCET: 15,
  journeeSolidariteAppliquee: false,
  // Compteurs optionnels (autres corps / services)
  hasARTT: false,
  artt: undefined,
  caAnterieur: 0,
  caHPAnterieur: 0,
  hasCET2008: false,
  cet2008: undefined,
  hasCongesBonifies: false,
  congesBonifies: undefined,
  congesBonifiesDateOuverture: undefined,
  hsHistorique: 0,
};

export const DEFAULT_USER_DATA: UserData = {
  cycleConfig: DEFAULT_CYCLE_CONFIG,
  counters: DEFAULT_COUNTERS,
  history: [],
  lastUpdated: new Date().toISOString(),
  isOnboarded: false,
};

// ============================================
// FONCTIONS DE STOCKAGE
// ============================================

/**
 * Vérifie si le localStorage est disponible
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migre les données utilisateur vers la nouvelle version (APORTT)
 * - Ajoute le pattern de cycle si absent
 * - Initialise le flag journée de solidarité si absent
 */
export function migrateUserData(data: UserData): UserData {
  let needsSave = false;

  // Migration 1: Initialiser le flag journée de solidarité si absent
  if (data.counters.journeeSolidariteAppliquee === undefined) {
    data.counters.journeeSolidariteAppliquee = false;
    needsSave = true;
  }

  // Migration 2: Pattern de cycle par défaut
  if (!data.cycleConfig.pattern && data.cycleConfig.heuresParJour === HEURES_PAR_JOUR) {
    data.cycleConfig.pattern = '2/2/3/2/2/3'; // Par défaut pour 12h08
    needsSave = true;
  }

  // Migration 3: Initialiser les nouveaux compteurs optionnels si absents (rétrocompatibilité)
  if (data.counters.hasARTT === undefined) { data.counters.hasARTT = false; needsSave = true; }
  if (data.counters.caAnterieur === undefined) { data.counters.caAnterieur = 0; needsSave = true; }
  if (data.counters.caHPAnterieur === undefined) { data.counters.caHPAnterieur = 0; needsSave = true; }
  if (data.counters.hasCET2008 === undefined) { data.counters.hasCET2008 = false; needsSave = true; }
  if (data.counters.hasCongesBonifies === undefined) { data.counters.hasCongesBonifies = false; needsSave = true; }
  if (data.counters.hsHistorique === undefined) { data.counters.hsHistorique = 0; needsSave = true; }

  // Migration 5: heuresSemaine pour cycle hebdo (depuis l'ancien modèle 4 longs + 1 court)
  if (data.cycleConfig.type === 'hebdo' && !data.cycleConfig.heuresSemaine) {
    const normal = data.cycleConfig.heuresParJour ?? DEFAULT_HEBDO_HEURES.lundi;
    const court = data.cycleConfig.heuresJourCourt ?? DEFAULT_HEBDO_HEURES.vendredi;
    data.cycleConfig.heuresSemaine = {
      lundi: normal, mardi: normal, mercredi: normal, jeudi: normal,
      vendredi: court, samedi: 0, dimanche: 0,
    };
    needsSave = true;
  }

  // Migration 4: Reset annuel des compteurs périodiques
  // caPosesHorsPeriode et caHP doivent être remis à 0 chaque année (règle APORTT)
  const currentYear = new Date().getFullYear();
  if ((data.lastResetYear ?? 0) < currentYear) {
    data.counters.caPosesHorsPeriode = 0;
    data.counters.caHP = 0;
    data.counters.cfConsoS1 = 0;
    data.counters.cfConsoS2 = 0;
    data.counters.caConsommes = 0;
    data.lastResetYear = currentYear;
    needsSave = true;
  }

  // Sauvegarder si des migrations ont été appliquées
  if (needsSave) {
    saveUserData(data);
  }

  return data;
}

/**
 * Charge les données utilisateur depuis localStorage
 */
export function loadUserData(): UserData | null {
  if (!isStorageAvailable()) return null;

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    const validation = nativeValidateUserData(parsed);

    if (!validation.success) {
      logger.warn('Données utilisateur invalides, tentative de récupération', {
        error: validation.error,
      });
      // Tenter une validation legacy pour rétrocompatibilité
      if (!legacyValidateUserData(parsed)) {
        logger.error('Échec de la validation des données',
          ChronosError.validationError(validation.error)
        );
        return null;
      }
    }

    // Appliquer les migrations si nécessaire
    return migrateUserData(parsed as UserData);
  } catch (error) {
    logger.error('Erreur lors du chargement des données',
      ChronosError.storageError('Impossible de charger les données', 'read'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    return null;
  }
}

/**
 * Sauvegarde les données utilisateur dans localStorage
 */
export function saveUserData(data: UserData): boolean {
  if (!isStorageAvailable()) return false;

  try {
    const toSave = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    logger.debug('Données sauvegardées avec succès');
    return true;
  } catch (error) {
    logger.error('Erreur lors de la sauvegarde des données',
      ChronosError.storageError('Impossible de sauvegarder les données', 'write'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    return false;
  }
}

/**
 * Met à jour partiellement les données utilisateur
 */
export function updateUserData(updates: Partial<UserData>): UserData | null {
  const current = loadUserData();
  if (!current) return null;

  const updated = { ...current, ...updates };
  const success = saveUserData(updated);

  return success ? updated : null;
}

/**
 * Met à jour les compteurs
 */
export function updateCounters(counters: Partial<Counters>): UserData | null {
  const current = loadUserData();
  if (!current) return null;

  const updated = {
    ...current,
    counters: { ...current.counters, ...counters },
  };
  const success = saveUserData(updated);

  return success ? updated : null;
}

/**
 * Met à jour la configuration du cycle
 */
export function updateCycleConfig(cycleConfig: Partial<CycleConfig>): UserData | null {
  const current = loadUserData();
  if (!current) return null;

  const updated = {
    ...current,
    cycleConfig: { ...current.cycleConfig, ...cycleConfig },
  };
  const success = saveUserData(updated);

  return success ? updated : null;
}

/**
 * Ajoute une entrée à l'historique
 */
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id'>): UserData | null {
  const current = loadUserData();
  if (!current) return null;

  const newEntry: HistoryEntry = {
    ...entry,
    id: generateId(),
  };

  const updated = {
    ...current,
    history: [...current.history, newEntry],
  };
  const success = saveUserData(updated);

  return success ? updated : null;
}

/**
 * Réinitialise toutes les données
 */
export function resetAllData(): boolean {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.removeItem(STORAGE_KEY);
    logger.info('Données réinitialisées');
    return true;
  } catch (error) {
    logger.error('Erreur lors de la réinitialisation',
      ChronosError.storageError('Impossible de réinitialiser les données', 'write'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    return false;
  }
}

/**
 * Initialise les données avec les valeurs par défaut
 */
export function initializeDefaultData(): UserData {
  const defaultData = { ...DEFAULT_USER_DATA };
  saveUserData(defaultData);
  return defaultData;
}

// ============================================
// EXPORT / IMPORT
// ============================================

/**
 * Exporte les données au format JSON
 */
export function exportData(): ExportData | null {
  const userData = loadUserData();
  if (!userData) return null;

  return {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    cycleConfig: userData.cycleConfig,
    counters: userData.counters,
    history: userData.history,
  };
}

/**
 * Génère un fichier JSON téléchargeable
 */
export function downloadExport(): boolean {
  const data = exportData();
  if (!data) {
    logger.error('Aucune donnée à exporter',
      ChronosError.exportError('Aucune donnée disponible pour l\'export')
    );
    return false;
  }

  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronos-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logger.info('Export téléchargé avec succès');
    return true;
  } catch (error) {
    logger.error('Erreur lors de l\'export',
      ChronosError.exportError('Impossible de générer le fichier d\'export'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    return false;
  }
}

/**
 * Importe des données depuis un fichier JSON
 */
export function importData(jsonData: string, merge: boolean = false): { success: boolean; error?: string } {
  try {
    // Parser le JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonData);
    } catch {
      logger.error('JSON invalide lors de l\'import',
        ChronosError.importError('Le fichier n\'est pas un JSON valide')
      );
      return { success: false, error: 'Le fichier n\'est pas un JSON valide' };
    }

    // Valider avec Zod
    const validation = validateExportData(parsed);
    if (!validation.success) {
      logger.error('Validation de l\'import échouée',
        ChronosError.importError(validation.error),
        { details: validation.details }
      );
      return { success: false, error: validation.error };
    }

    const data = validation.data;
    const currentData = loadUserData();

    let newData: UserData;
    if (merge && currentData) {
      // Fusion : garde l'historique existant + nouveau
      newData = {
        cycleConfig: data.cycleConfig,
        counters: data.counters,
        history: [...currentData.history, ...data.history],
        lastUpdated: new Date().toISOString(),
        isOnboarded: true,
      };
    } else {
      // Remplacement total
      newData = {
        cycleConfig: data.cycleConfig,
        counters: data.counters,
        history: data.history,
        lastUpdated: new Date().toISOString(),
        isOnboarded: true,
      };
    }

    const success = saveUserData(newData);
    if (success) {
      logger.info('Import réussi', { merge, historyCount: newData.history.length });
    }
    return { success };
  } catch (error) {
    logger.error('Erreur inattendue lors de l\'import',
      ChronosError.importError('Erreur inattendue'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    return { success: false, error: 'Erreur inattendue lors de l\'import' };
  }
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validation legacy pour rétrocompatibilité
 * @deprecated Utiliser validateUserData à la place
 */
function legacyValidateUserData(data: unknown): data is UserData {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  return (
    'cycleConfig' in obj &&
    'counters' in obj &&
    'history' in obj &&
    typeof obj.isOnboarded === 'boolean'
  );
}

/**
 * Valide la structure des données utilisateur (utilise Zod)
 */
export function validateUserData(data: unknown): data is UserData {
  const result = nativeValidateUserData(data);
  if (result.success) return true;

  // Fallback sur validation legacy
  return legacyValidateUserData(data);
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Génère un ID unique
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
