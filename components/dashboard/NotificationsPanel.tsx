// Modale de notifications pour les alertes deadline

'use client';

import { DeadlineNotification } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: DeadlineNotification[];
  onDismiss: (id: string) => void;
  onRequestPermission: () => void;
  permissionGranted: boolean;
  isSupported: boolean;
}

const priorityConfig = {
  urgent: {
    icon: AlertTriangle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
};

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onDismiss,
  onRequestPermission,
  permissionGranted,
  isSupported,
}: NotificationsPanelProps) {
  const urgentCount = notifications.filter((n) => n.priority === 'urgent').length;
  const warningCount = notifications.filter((n) => n.priority === 'warning').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-md p-0 bg-background border-0 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ height: '85vh', maxHeight: '85vh' }}
        showCloseButton={false}
      >
        {/* Header gradient bleu foncé */}
        <div
          className="px-6 pt-6 pb-5 text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight text-white">
                Alertes &amp; Rappels
              </DialogTitle>
              <DialogDescription className="text-blue-200 text-xs mt-0.5">
                Vos deadlines et notifications importantes
              </DialogDescription>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          {(urgentCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-2 mt-3">
              {urgentCount > 0 && (
                <Badge className="bg-red-500/20 text-red-100 border-red-400/30 hover:bg-red-500/20">
                  {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-100 border-amber-400/30 hover:bg-amber-500/20">
                  {warningCount} attention
                </Badge>
              )}
            </div>
          )}
          <div
            className="mt-4 h-[3px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }}
          />
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {/* Permission notifications */}
          {isSupported && !permissionGranted && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-start gap-3">
                <BellOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    Notifications désactivées
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Activez les notifications pour recevoir des rappels avant les deadlines.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={onRequestPermission}
                  >
                    Activer les notifications
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Liste des notifications */}
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" aria-hidden="true" />
              <p className="text-sm text-slate-500">
                Aucune alerte pour le moment
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Vos compteurs sont en ordre !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const config = priorityConfig[notification.priority];
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 rounded-lg border transition-all',
                      config.bg,
                      config.border
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', config.iconColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium text-slate-800">
                            {notification.title}
                          </h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 -mt-1 -mr-2"
                            onClick={() => onDismiss(notification.id)}
                            aria-label="Ignorer cette notification"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge
                            variant="secondary"
                            className={cn('text-xs', config.badge)}
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            {notification.daysRemaining}j restants
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-slate-100 text-slate-600"
                          >
                            {notification.counterType.toUpperCase()}
                          </Badge>
                        </div>
                        {notification.actionLabel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 text-xs"
                            onClick={onClose}
                          >
                            {notification.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <p className="text-xs text-slate-500 text-center">
            Les alertes sont basées sur vos compteurs actuels et les deadlines APORTT.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
