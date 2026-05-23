// Système de notifications pour les deadlines Chronos

import { Counters } from './types';
import {
  CA_MAX_VERS_CET,
  RTC_RESERVES_CET,
  CF_PAR_SEMESTRE,
  CET_PLAFOND,
  CET_APPORT_ANNUEL_MAX,
} from './constants';
import { formatMinutes, getDaysUntil, getRTCLibres } from './calculations';

// ============================================
// TYPES
// ============================================

export type NotificationPriority = 'urgent' | 'warning' | 'info';

export interface DeadlineNotification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  daysRemaining: number;
  deadline: Date;
  counterType: string;
  actionLabel?: string;
}

export interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
}

// ============================================
// CONSTANTES
// ============================================

const NOTIFICATION_THRESHOLDS = {
  urgent: 7,    // 7 jours ou moins = urgent
  warning: 30,  // 30 jours ou moins = warning
  info: 60,     // 60 jours ou moins = info
};

// ============================================
// PERMISSION API
// ============================================

/**
 * Vérifie si les notifications sont supportées
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Récupère l'état actuel de la permission
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) {
    return { permission: 'denied', isSupported: false };
  }
  return { permission: Notification.permission, isSupported: true };
}

/**
 * Demande la permission pour les notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
}

/**
 * Envoie une notification système
 */
export function sendSystemNotification(
  title: string,
  options?: NotificationOptions
): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      ...options,
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// CALCUL DES DEADLINES
// ============================================

/**
 * Calcule les deadlines importantes et génère les notifications
 */
export function calculateDeadlineNotifications(
  counters: Counters,
  currentDate: Date = new Date()
): DeadlineNotification[] {
  const notifications: DeadlineNotification[] = [];
  const year = currentDate.getFullYear();

  // 1. Deadline CA - 31 décembre
  const caDeadline = new Date(year, 11, 31);
  const daysUntilCA = getDaysUntil(caDeadline, currentDate);

  if (daysUntilCA > 0 && daysUntilCA <= NOTIFICATION_THRESHOLDS.info) {
    const caExcedentaires = Math.max(0, counters.ca - CA_MAX_VERS_CET);

    if (caExcedentaires > 0) {
      notifications.push({
        id: 'ca-deadline',
        title: 'CA excédentaires à poser',
        message: `${caExcedentaires} CA seront perdus au 31/12 s'ils ne sont pas posés ou transférés au CET.`,
        priority: getPriority(daysUntilCA),
        daysRemaining: daysUntilCA,
        deadline: caDeadline,
        counterType: 'ca',
        actionLabel: 'Planifier mes congés',
      });
    }
  }

  // 2. Deadline RTC libres - 31 décembre
  const rtcLibres = getRTCLibres(counters.rtc);

  if (daysUntilCA > 0 && daysUntilCA <= NOTIFICATION_THRESHOLDS.info && rtcLibres > 0) {
    notifications.push({
      id: 'rtc-deadline',
      title: 'RTC libres à utiliser',
      message: `${formatMinutes(rtcLibres)} de RTC libres seront perdus au 31/12.`,
      priority: getPriority(daysUntilCA),
      daysRemaining: daysUntilCA,
      deadline: caDeadline,
      counterType: 'rtc',
      actionLabel: 'Planifier mes RTC',
    });
  }

  // 3. Alerte RTC réservés entamés
  if (counters.rtc < RTC_RESERVES_CET) {
    const rtcManquants = RTC_RESERVES_CET - counters.rtc;
    notifications.push({
      id: 'rtc-reserves-alert',
      title: 'RTC réservés entamés !',
      message: `Il vous manque ${formatMinutes(rtcManquants)} pour reconstituer vos RTC réservés CET. Vous perdez du gain potentiel.`,
      priority: 'urgent',
      daysRemaining: daysUntilCA,
      deadline: caDeadline,
      counterType: 'rtc',
    });
  }

  // 4. Deadline CF S1 - 30 juin (conseil de lissage)
  const s1Deadline = new Date(year, 5, 30);
  const daysUntilS1 = getDaysUntil(s1Deadline, currentDate);
  const semester = currentDate.getMonth() < 6 ? 1 : 2;

  if (semester === 1 && daysUntilS1 > 0 && daysUntilS1 <= NOTIFICATION_THRESHOLDS.info) {
    const cfRestantS1 = Math.max(0, CF_PAR_SEMESTRE - counters.cfConsoS1);

    if (cfRestantS1 > CF_PAR_SEMESTRE * 0.3) { // Plus de 30% non utilisés
      notifications.push({
        id: 'cf-s1-conseil',
        title: 'Conseil CF Semestre 1',
        message: `${formatMinutes(cfRestantS1)} de CF à lisser avant fin juin. Pensez à équilibrer vos CF sur l'année.`,
        priority: daysUntilS1 <= 14 ? 'warning' : 'info',
        daysRemaining: daysUntilS1,
        deadline: s1Deadline,
        counterType: 'cf',
      });
    }
  }

  // 5. Deadline CF S2 - 31 décembre
  if (semester === 2 && daysUntilCA > 0 && daysUntilCA <= NOTIFICATION_THRESHOLDS.info) {
    const cfRestantS2 = Math.max(0, CF_PAR_SEMESTRE - counters.cfConsoS2);

    if (cfRestantS2 > CF_PAR_SEMESTRE * 0.3) {
      notifications.push({
        id: 'cf-s2-conseil',
        title: 'Conseil CF Semestre 2',
        message: `${formatMinutes(cfRestantS2)} de CF restants pour ce semestre.`,
        priority: getPriority(daysUntilCA),
        daysRemaining: daysUntilCA,
        deadline: caDeadline,
        counterType: 'cf',
      });
    }
  }

  // 6. Transfert CET possible avant la deadline
  const cetDisponible = Math.min(CET_PLAFOND - counters.cet, CET_APPORT_ANNUEL_MAX);
  if (cetDisponible > 0 && daysUntilCA <= NOTIFICATION_THRESHOLDS.warning) {
    notifications.push({
      id: 'cet-transfert',
      title: 'Transfert CET possible',
      message: `Vous pouvez encore épargner ${cetDisponible} jour(s) au CET avant le 31/12. Pensez à optimiser vos transferts.`,
      priority: daysUntilCA <= 14 ? 'warning' : 'info',
      daysRemaining: daysUntilCA,
      deadline: caDeadline,
      counterType: 'cet',
    });
  }

  // Trier par priorité puis par jours restants
  return notifications.sort((a, b) => {
    const priorityOrder = { urgent: 0, warning: 1, info: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.daysRemaining - b.daysRemaining;
  });
}

/**
 * Détermine la priorité selon le nombre de jours restants
 */
function getPriority(daysRemaining: number): NotificationPriority {
  if (daysRemaining <= NOTIFICATION_THRESHOLDS.urgent) return 'urgent';
  if (daysRemaining <= NOTIFICATION_THRESHOLDS.warning) return 'warning';
  return 'info';
}

/**
 * Formate un message de notification pour affichage
 */
export function formatNotificationMessage(notification: DeadlineNotification): string {
  const daysText = notification.daysRemaining === 1
    ? '1 jour'
    : `${notification.daysRemaining} jours`;

  return `${notification.title} - ${daysText} restants`;
}

/**
 * Planifie l'envoi de notifications système
 */
export function scheduleDeadlineNotifications(
  counters: Counters,
  onNotification?: (notification: DeadlineNotification) => void
): void {
  const notifications = calculateDeadlineNotifications(counters);

  notifications.forEach((notification) => {
    if (notification.priority === 'urgent' || notification.priority === 'warning') {
      const sent = sendSystemNotification(notification.title, {
        body: notification.message,
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
      });

      if (sent && onNotification) {
        onNotification(notification);
      }
    }
  });
}
