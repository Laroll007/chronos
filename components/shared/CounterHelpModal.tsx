'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

export const HELP_CONTENT: Record<string, { title: string; bullets: string[]; warning?: string; tip?: string }> = {
  cet: {
    title: 'Compte Épargne Temps (CET)',
    bullets: [
      'Plafond légal : 60 jours au total.',
      'Apport annuel maximum : 15 jours.',
      'Sources : RTC (max 10j/an), CA classiques (max 5j/an), CA Hors Période (max 2j/an), Heures Sup (max 5j).',
      'Les jours épargnés sont conservés indéfiniment.',
    ],
    tip: 'Astuce RTC : convertir 83h30 de RTC en 10j CET coûte 8h21/jour au lieu de 12h08 → gain de 3h47 par jour converti.',
  },
  ca: {
    title: 'Congés Annuels (CA)',
    bullets: [
      '18 jours par an pour le cycle 2/2/3/2/2/3.',
      'Perdus définitivement au 31 décembre si non posés.',
      'Maximum 5 jours transférables au CET avant le 31/12.',
      'Pose possible tout au long de l\'année selon les besoins.',
    ],
    warning: 'Attention : les CA non posés et non transférés au CET sont perdus au 31/12 sans compensation.',
  },
  caHP: {
    title: 'CA Hors Période (CA HP)',
    bullets: [
      'Bonus de 2 jours attribué si vous posez 8 CA ou plus en dehors de la période estivale.',
      'Période "hors période" : 1er janvier → 30 avril et 1er novembre → 31 décembre.',
      'Ces 2 jours bonus sont transférables au CET (en plus des 5 CA classiques).',
      'Le compteur indique combien de CA vous avez déjà posés hors période cette année.',
    ],
    tip: 'Si vous atteignez 8 CA hors période, vous débloquez automatiquement 2 jours CET supplémentaires.',
  },
  cf: {
    title: 'Crédits Fériés (CF)',
    bullets: [
      'Crédit annuel : 109h12, attribué en début d\'année.',
      'À consommer sur l\'année : idéalement ~54h36 par semestre.',
      'Perdus au 31 décembre s\'ils ne sont pas utilisés.',
      'Non transférables au CET.',
    ],
    warning: 'En cas d\'arrêt maladie ≥ 15 jours consécutifs : déduction de 1/24ème du crédit annuel par tranche de 15 jours (ex : 30j maladie = −9h06).',
  },
  rtc: {
    title: 'Récupération Temps de Cycle (RTC)',
    bullets: [
      'RTC brut annuel : 285h13 (soit 273h05 net après déduction de la Journée de Solidarité de 12h08).',
      '83h30 doivent être réservés pour alimenter le CET (= 10 jours).',
      'Le reste (RTC libres) peut être posé comme congé.',
      'Les RTC non utilisés sont perdus au 31 décembre.',
    ],
    tip: 'La Journée de Solidarité déduit 12h08 de vos RTC. Cochez l\'option si elle s\'applique à votre cycle.',
  },
  rtt: {
    title: 'RTT (Réduction du Temps de Travail)',
    bullets: [
      'Applicable uniquement aux cycles hebdomadaires.',
      'Calculé selon les heures supplémentaires à la semaine.',
      'Perdus au 31 décembre s\'ils ne sont pas consommés.',
      'Non transférables au CET.',
    ],
  },
  rps: {
    title: 'RPS – Récupération dimanche',
    bullets: [
      'Acquis chaque dimanche travaillé selon votre planning.',
      'Reportables indéfiniment : il n\'y a pas de perte en fin d\'année.',
      'Utilisables comme congés sur le calendrier.',
      'Le stock "année précédente" correspond aux RPS reportés de N-1.',
    ],
    tip: 'Contrairement aux autres compteurs, les RPS ne sont jamais perdus : vous pouvez les accumuler sans limite de temps.',
  },
  hs: {
    title: 'Heures Supplémentaires (HS)',
    bullets: [
      'Plafond de stockage : 160 heures.',
      'Au-delà de 160h : les heures supplémentaires doivent être payées (impossibles à stocker).',
      'Reportables d\'une année sur l\'autre dans la limite du plafond.',
      'Maximum 5 jours transférables au CET.',
    ],
    warning: 'Si votre stock dépasse 160h, vous perdez la possibilité de les récupérer sous forme de congé : elles doivent être rémunérées.',
  },
  caAnterieur: {
    title: 'CA Antérieurs (report N-1)',
    bullets: [
      'Congés Annuels reportés de l\'année précédente.',
      'Deadline impérative : 30 avril.',
      'Au-delà du 30 avril, les CA antérieurs non posés sont définitivement perdus.',
      'À consommer en priorité avant les CA de l\'année en cours.',
    ],
    warning: 'Posez ces jours en priorité — ils ne sont pas transférables au CET et expirent au 30 avril.',
  },
  caHPAnterieur: {
    title: 'CA HP Antérieurs (bonus N-1)',
    bullets: [
      'Bonus CA Hors Période obtenu l\'année précédente.',
      'Deadline impérative : 30 avril.',
      'Doit être posé pendant les périodes hors saison estivale (jan–avr ou nov–déc).',
      'Non transférable au CET.',
    ],
    warning: 'À utiliser avant le 30 avril sous peine d\'être perdu.',
  },
  artt: {
    title: 'ARTT (Aménagement RTT)',
    bullets: [
      'Quota annuel : 20 jours (arrêté du 3 mai 2002).',
      'Spécifique à certains corps de la fonction publique.',
      'Perdus au 31 décembre s\'ils ne sont pas consommés.',
      'Non transférables au CET.',
    ],
  },
  cet2008: {
    title: 'CET 2008 (stock historique)',
    bullets: [
      'Stock issu du dispositif CET antérieur à 2010 (décret 2009-1065).',
      'Solde gelé : il ne peut plus être alimenté depuis 2010.',
      'Aucune deadline : conservé indéfiniment.',
      'Utilisable comme congé classique au calendrier.',
    ],
  },
  congesBonifies: {
    title: 'Congés Bonifiés (DOM/TOM)',
    bullets: [
      'Quota : 31 jours par cycle de 24 mois (décret 2020-851).',
      'Réservés aux agents originaires d\'outre-mer en métropole (et inversement).',
      'Doivent être posés en une seule fois.',
      'Bénéficient d\'un congé bonifié indemnisé (transport).',
    ],
    tip: 'Renseignez la date d\'ouverture des droits pour suivre la deadline (3 ans + 1 an de tolérance).',
  },
  hsHistorique: {
    title: 'HS Historique (stock antérieur 2020)',
    bullets: [
      'Stock d\'heures supplémentaires accumulé avant 2020.',
      'Solde gelé : ne peut plus être alimenté.',
      'Indemnisable au taux de 13,25 €/h.',
      'Aucune deadline.',
    ],
  },
};

export function CounterHelpButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
      className={`inline-flex items-center justify-center rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0 ${className ?? 'ml-1.5 w-5 h-5'}`}
      aria-label="En savoir plus"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
}

export function CounterHelpModal({ helpKey, onClose }: { helpKey: string; onClose: () => void }) {
  const content = HELP_CONTENT[helpKey];
  const mountRef = useRef<Element | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    mountRef.current = document.body;
    setMounted(true);
  }, []);

  if (!content || !mounted || !mountRef.current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ pointerEvents: 'auto' }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ pointerEvents: 'auto' }}
      />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #0055A4 33.3%, #ffffff 33.3%, #ffffff 66.6%, #EF4135 66.6%)' }} />
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 leading-snug pr-4">{content.title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2 mb-3">
            {content.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0055A4' }} />
                {b}
              </li>
            ))}
          </ul>
          {content.warning && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-xs text-red-700">⚠ {content.warning}</p>
            </div>
          )}
          {content.tip && (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-700">💡 {content.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    mountRef.current
  );
}
