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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Bouton Profil (gauche) */}
          <Button
            variant="ghost"
            size="default"
            onClick={onProfileClick}
            className="flex items-center gap-2"
          >
            <User className="w-5 h-5 text-blue-600" />
            <span className="hidden sm:inline">Profil</span>
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
          <div className="hidden md:block">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Chronos
            </h1>
          </div>

          {/* Boutons Notifications, Compteurs et Réglages (droite) */}
          <div className="flex items-center gap-2">
            {onNotificationsClick && (
              <Button
                variant="ghost"
                size="default"
                onClick={onNotificationsClick}
                className="flex items-center gap-2 relative"
                aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} alertes` : ''}`}
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="default"
              onClick={onCountersClick}
              className="flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="hidden sm:inline">Compteurs</span>
            </Button>
            <Button
              variant="ghost"
              size="default"
              onClick={onSettingsClick}
              className="flex items-center gap-2"
            >
              <Settings className="w-5 h-5 text-slate-600" />
              <span className="hidden sm:inline">Réglages</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
