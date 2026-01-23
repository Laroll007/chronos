// Hook React pour gérer les notifications deadline

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Counters } from '@/lib/types';
import {
  DeadlineNotification,
  NotificationPermissionState,
  calculateDeadlineNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  isNotificationSupported,
  sendSystemNotification,
} from '@/lib/notifications';

interface UseNotificationsOptions {
  counters: Counters | null;
  enabled?: boolean;
}

interface UseNotificationsReturn {
  notifications: DeadlineNotification[];
  urgentCount: number;
  warningCount: number;
  permissionState: NotificationPermissionState;
  requestPermission: () => Promise<NotificationPermission>;
  sendNotification: (notification: DeadlineNotification) => boolean;
  dismissNotification: (id: string) => void;
  dismissedIds: string[];
  isSupported: boolean;
}

const DISMISSED_KEY = 'chronos_dismissed_notifications';

/**
 * Hook pour gérer les notifications de deadline
 */
export function useNotifications({
  counters,
  enabled = true,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Charger les notifications dismissées depuis localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Nettoyer les anciennes (plus de 24h)
        const now = Date.now();
        const valid = Object.entries(parsed)
          .filter(([, timestamp]) => now - (timestamp as number) < 24 * 60 * 60 * 1000)
          .map(([id]) => id);
        setDismissedIds(valid);
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }, []);

  // Calculer les notifications
  const allNotifications = useMemo(() => {
    if (!counters || !enabled) return [];
    return calculateDeadlineNotifications(counters);
  }, [counters, enabled]);

  // Filtrer les notifications dismissées
  const notifications = useMemo(() => {
    return allNotifications.filter((n) => !dismissedIds.includes(n.id));
  }, [allNotifications, dismissedIds]);

  // Compter par priorité
  const urgentCount = useMemo(
    () => notifications.filter((n) => n.priority === 'urgent').length,
    [notifications]
  );

  const warningCount = useMemo(
    () => notifications.filter((n) => n.priority === 'warning').length,
    [notifications]
  );

  // Demander la permission
  const requestPermission = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setPermissionState(getNotificationPermission());
    return permission;
  }, []);

  // Envoyer une notification système
  const sendNotification = useCallback((notification: DeadlineNotification): boolean => {
    return sendSystemNotification(notification.title, {
      body: notification.message,
      tag: notification.id,
      requireInteraction: notification.priority === 'urgent',
    });
  }, []);

  // Dismiss une notification
  const dismissNotification = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const updated = [...prev, id];

      // Sauvegarder avec timestamp
      try {
        const stored = localStorage.getItem(DISMISSED_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        parsed[id] = Date.now();
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer
      }

      return updated;
    });
  }, []);

  // Mettre à jour la permission si elle change
  useEffect(() => {
    if (!isNotificationSupported()) return;

    // Vérifier périodiquement (au cas où l'utilisateur change dans les paramètres navigateur)
    const interval = setInterval(() => {
      const current = getNotificationPermission();
      if (current.permission !== permissionState.permission) {
        setPermissionState(current);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [permissionState.permission]);

  return {
    notifications,
    urgentCount,
    warningCount,
    permissionState,
    requestPermission,
    sendNotification,
    dismissNotification,
    dismissedIds,
    isSupported: isNotificationSupported(),
  };
}
