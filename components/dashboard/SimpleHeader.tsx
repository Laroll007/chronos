// Header minimaliste avec boutons Profil et Réglages

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Settings, BarChart3, Bell } from 'lucide-react';
import { CycleInfo } from '@/hooks/useCycle';

interface SimpleHeaderProps {
  cycleInfo: CycleInfo | null;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onCountersClick: () => void;
  onNotificationsClick?: () => void;
  notificationCount?: number;
}

export function SimpleHeader({
  cycleInfo,
  onProfileClick,
  onSettingsClick,
  onCountersClick,
  onNotificationsClick,
  notificationCount = 0,
}: SimpleHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full glass-strong safe-top">
      <div className="container max-w-7xl mx-auto px-4 safe-x">
        <div className="flex h-14 items-center justify-between">
          {/* Bouton Profil (gauche) */}
          <Button
            variant="ghost"
            size="default"
            onClick={onProfileClick}
            className="flex items-center gap-2"
          >
            <User className="w-5 h-5 text-blue-600" />
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span>Profil</span>
            </div>
            {cycleInfo && (
              <div className="hidden md:flex items-center gap-2 ml-2">
                <Badge
                  variant="secondary"
                  className={
                    cycleInfo.currentWeekType === 'A'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }
                >
                  Semaine {cycleInfo.currentWeekType}
                </Badge>
                <Badge
                  variant="secondary"
                  className={
                    cycleInfo.isWorkingToday
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }
                >
                  {cycleInfo.isWorkingToday ? 'Travail' : 'Repos'}
                </Badge>
              </div>
            )}
          </Button>

          {/* Logo/Titre au centre */}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gradient whitespace-nowrap">
              My Chronos
            </h1>
          </div>

          {/* Boutons Notifications, Compteurs et Réglages (droite) */}
          <div className="flex items-center gap-0 sm:gap-1 flex-shrink-0">
            {onNotificationsClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNotificationsClick}
                className="relative h-9 w-9 flex items-center justify-center"
                aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} alertes` : ''}`}
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {notificationCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium leading-none">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onCountersClick}
              className="h-9 w-9 sm:w-auto flex items-center justify-center gap-2 px-0 sm:px-3"
              aria-label="Voir les compteurs"
            >
              <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="hidden sm:inline text-sm">Compteurs</span>
            </Button>
            <Button
              variant="ghost"
              onClick={onSettingsClick}
              className="h-9 w-9 sm:w-auto flex items-center justify-center gap-2 px-0 sm:px-3"
              aria-label="Paramètres"
            >
              <Settings className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <span className="hidden sm:inline text-sm">Paramètres</span>
            </Button>
          </div>
        </div>
      </div>
      {/* Bande tricolore séparatrice */}
      <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right, #0055A4 33.3%, #ffffff 33.3%, #ffffff 66.6%, #EF4135 66.6%)' }} />
    </header>
  );
}
