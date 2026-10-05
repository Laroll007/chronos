'use client';

import { cn } from '@/lib/utils';

const HEURES = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

interface TimeSelectProps {
  /** « HH:MM », ou '' si `facultatif` et non renseigné. */
  value: string;
  onChange: (value: string) => void;
  /** Porté par la liste des heures, pour le <label htmlFor>. */
  id?: string;
  /** Libellé du champ (« Prise de service ») : nomme la liste des minutes. */
  label?: string;
  /** Ajoute un choix vide (« -- ») : l'heure peut rester non renseignée. */
  facultatif?: boolean;
  className?: string;
}

/**
 * Heure et minutes dans deux listes déroulantes. Remplace <input type="time"> :
 * sur certains Android, l'horloge native place son bouton « OK » hors de
 * l'écran. Les minutes vont de 1 en 1 (vacations en 19h08, 06h38…).
 */
export function TimeSelect({ value, onChange, id, label, facultatif = false, className }: TimeSelectProps) {
  const [h = '', m = ''] = value ? value.split(':') : [];
  const select = cn(
    'h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-800 text-center',
    className
  );

  return (
    <div className="flex items-center gap-1">
      <select
        id={id}
        aria-label={id ? undefined : label ? `${label}, heure` : 'Heure'}
        value={h}
        onChange={(e) => {
          const heure = e.target.value;
          onChange(heure ? `${heure}:${m || '00'}` : '');
        }}
        className={select}
      >
        {facultatif && <option value="">--</option>}
        {HEURES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <span className="text-slate-500 font-medium" aria-hidden="true">h</span>
      <select
        aria-label={label ? `${label}, minutes` : 'Minutes'}
        value={m}
        disabled={facultatif && !h}
        onChange={(e) => onChange(`${h || '00'}:${e.target.value}`)}
        className={cn(select, 'disabled:opacity-50')}
      >
        {facultatif && !h && <option value="">--</option>}
        {MINUTES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </div>
  );
}
