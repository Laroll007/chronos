// Panel de notifications pour les alertes deadline

'use client';

import { DeadlineNotification } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-6 pb-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Bell className="w-5 h-5 text-blue-600" />
              Alertes & Rappels
            </SheetTitle>
            <div className="flex items-center gap-2">
              {urgentCount > 0 && (
                <Badge className="bg-red-100 text-red-700">
                  {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  {warningCount} attention
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-4 space-y-4">
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
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
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
        </ScrollArea>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Les alertes sont basées sur vos compteurs actuels et les deadlines APORTT.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
