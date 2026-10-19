'use client';

import { useState, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { APP_VERSION } from '@/lib/constants';
import { CycleConfig, Counters, HistoryEntry } from '@/lib/types';
import type { ParamsChangement } from '@/lib/changementCycle';
import { ChangementCycle } from './ChangementCycle';
import { downloadExport, importData, resetAllData } from '@/lib/storage';
import { isStatsEnabled, setStatsEnabled, track } from '@/lib/analytics';
import { ouvrirCommunaute } from '@/lib/communaute';
import { DiscordLogo } from '@/components/shared/DiscordLogo';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  MessageSquareHeart,
  Coffee,
  ChevronRight,
  CalendarCog,
  DatabaseBackup,
  Heart,
  Calculator,
  Sunset,
  Wrench,
  ShieldCheck,
  Sparkles,
  X,
  Share2,
  Star,
} from 'lucide-react';
import { RecommanderModal } from '@/components/shared/RecommanderModal';
import { lienAvisStore, ouvrirFicheStore, plateforme } from '@/lib/recommandation';
import { toast } from 'sonner';

const FeedbackModal = lazy(() =>
  import('@/components/dashboard/FeedbackModal').then((m) => ({ default: m.FeedbackModal }))
);

const WorkedDaysCalculator = lazy(() =>
  import('@/components/dashboard/WorkedDaysCalculator').then((m) => ({ default: m.WorkedDaysCalculator }))
);

// Réutilise l'écran d'onboarding, qui accepte déjà un `initialConfig`.
const RetraiteCalculator = lazy(() =>
  import('@/components/dashboard/RetraiteCalculator').then((m) => ({ default: m.RetraiteCalculator }))
);

// ─── Sous-composants de mise en page ─────────────────────────────────────────

/** Dégradé d'une pastille d'icône : [clair, foncé]. */
type Degrade = readonly [string, string];

const D = {
  bleu: ['#1a7de8', '#0055A4'],
  violet: ['#a78bfa', '#6d28d9'],
  orange: ['#fbbf24', '#ea580c'],
  rose: ['#f472b6', '#db2777'],
  ambre: ['#fcd34d', '#d97706'],
  ciel: ['#7dd3fc', '#0284c7'],
  turquoise: ['#5eead4', '#0f766e'],
  vert: ['#6ee7b7', '#059669'],
  rouge: ['#fda4af', '#e11d48'],
  // Discord : couleur de la marque, sans dégradé (règles de la marque).
  discord: ['#5865F2', '#5865F2'],
} as const satisfies Record<string, Degrade>;

/** Pastille d'icône : dégradé, reflet en haut, ombre douce de la même couleur. */
function Pastille({ degrade, petite = false, children }: { degrade: Degrade; petite?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`${petite ? 'w-7 h-7 rounded-lg' : 'w-10 h-10 rounded-xl'} flex items-center justify-center shrink-0 text-white`}
      style={{
        background: `linear-gradient(145deg, ${degrade[0]} 0%, ${degrade[1]} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 10px -3px ${degrade[1]}99`,
      }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

const TEINTES = {
  bleu: { fond: 'bg-blue-50 border-blue-200', titre: 'text-blue-800', degrade: D.bleu },
  violet: { fond: 'bg-violet-50 border-violet-200', titre: 'text-violet-800', degrade: D.violet },
  rose: { fond: 'bg-pink-50 border-pink-200', titre: 'text-pink-800', degrade: D.rose },
  turquoise: { fond: 'bg-teal-50 border-teal-200', titre: 'text-teal-800', degrade: D.turquoise },
  rouge: { fond: 'bg-rose-50 border-rose-200', titre: 'text-rose-800', degrade: D.rouge },
  vert: { fond: 'bg-emerald-50 border-emerald-200', titre: 'text-emerald-800', degrade: D.vert },
} as const;

/** Partie des paramètres : bloc teinté, titre en couleur, pour bien les distinguer. */
function Section({ teinte, icon, titre, children }: {
  teinte: keyof typeof TEINTES; icon: React.ReactNode; titre: string; children: React.ReactNode;
}) {
  const t = TEINTES[teinte];
  return (
    <section className={`rounded-2xl border p-3 space-y-2 ${t.fond}`}>
      <div className="flex items-center gap-2.5 px-1 pb-0.5">
        <Pastille degrade={t.degrade} petite>{icon}</Pastille>
        <h3 className={`text-[13px] font-bold uppercase tracking-[0.08em] ${t.titre}`}>{titre}</h3>
      </div>
      {children}
    </section>
  );
}

/**
 * Bouton d'une partie : carte blanche en relief, texte centré entre la
 * pastille et la flèche (colonnes de même largeur, pour un vrai centrage).
 */
function ClickableRow({
  icon,
  degrade,
  label,
  sublabel,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode;
  degrade: Degrade;
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant?: 'default' | 'ambre' | 'danger';
}) {
  const style = {
    default: { carte: 'bg-white border-slate-200/80', label: 'text-slate-800', sub: 'text-slate-500' },
    ambre: { carte: 'bg-amber-50 border-amber-200', label: 'text-amber-800', sub: 'text-amber-700' },
    danger: { carte: 'bg-white border-rose-200', label: 'text-rose-700', sub: 'text-rose-500' },
  }[variant];

  return (
    <button
      onClick={onClick}
      className={`grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 w-full px-3 py-3 rounded-xl border shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-150 text-center ${style.carte}`}
    >
      <Pastille degrade={degrade}>{icon}</Pastille>
      <span className="min-w-0">
        <span className={`block text-[15px] font-semibold leading-snug ${style.label}`}>{label}</span>
        {sublabel && <span className={`block text-xs mt-0.5 leading-snug ${style.sub}`}>{sublabel}</span>}
      </span>
      <ChevronRight className="justify-self-end w-5 h-5 text-slate-400" aria-hidden="true" />
    </button>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface SettingsProps {
  cycleConfig: CycleConfig;
  counters: Counters;
  history: HistoryEntry[];
  onReset: () => void;
  onShowWelcome?: () => void;
  /** Enregistre un nouveau cycle sans toucher aux compteurs ni à l'historique. */
  onUpdateCycle?: (config: CycleConfig) => boolean;
  /** Ouvre directement « Modifier mon cycle » (raccourci des nouveautés). */
  openCycleOnMount?: boolean;
  /** Changement de cycle en cours d'année (mutation). */
  onChangerCycle?: (p: ParamsChangement) => { ok: true } | { erreur: string };
  onAnnulerChangementCycle?: () => boolean;
}

export function Settings({
  cycleConfig,
  counters,
  history,
  onReset,
  onShowWelcome,
  onUpdateCycle,
  openCycleOnMount = false,
  onChangerCycle,
  onAnnulerChangementCycle,
}: SettingsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showRecommander, setShowRecommander] = useState(false);
  const [avisStore] = useState(() => (typeof window === 'undefined' ? null : lienAvisStore()));
  const nomStore = typeof window !== 'undefined' && plateforme() === 'ios' ? 'l’App Store' : 'le Play Store';
  const [showWorkedDays, setShowWorkedDays] = useState(false);
  const [showCycle, setShowCycle] = useState(openCycleOnMount);
  const [showRetraite, setShowRetraite] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statsEnabled, setStatsEnabledState] = useState(isStatsEnabled);

  const toggleStats = () => {
    const next = !statsEnabled;
    setStatsEnabled(next);
    setStatsEnabledState(next);
    toast.success(next ? 'Statistiques anonymes activées' : 'Statistiques anonymes désactivées');
  };

  const handleExport = async () => {
    const res = await downloadExport();
    if (res === 'ok') {
      track('backup_export');
      toast.success('Sauvegarde enregistrée');
    } else if (res === 'erreur') {
      toast.error("Erreur lors de l'export");
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const result = importData(text, false);
      if (result.success) {
        track('backup_import');
        toast.success('Import réussi', { description: 'Données chargées' });
        window.location.reload();
      } else {
        toast.error("Erreur d'import", { description: result.error });
      }
    } catch {
      toast.error('Erreur lors de la lecture du fichier');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    const success = resetAllData();
    if (success) {
      track('app_reset');
      toast.success('Données réinitialisées');
      setShowResetDialog(false);
      onReset();
      router.push('/onboarding');
    } else {
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ maxHeight: 'inherit', height: '100%' }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-6 pt-6 pb-5 text-white"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">Paramètres</h2>
            <p className="text-blue-200 text-xs mt-0.5">Outils et sauvegarde</p>
          </div>
          <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </DialogClose>
        </div>
        <div
          className="mt-4 h-[3px] rounded-full"
          style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }}
        />
      </div>

      {/* ── Contenu scrollable ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-4 space-y-4">

          {/* Cycle de travail */}
          {onUpdateCycle && (
            <Section teinte="bleu" icon={<CalendarCog className="w-4 h-4" />} titre="Mon cycle">
              <ClickableRow
                icon={<CalendarCog className="w-5 h-5" />}
                degrade={D.bleu}
                label="Modifier mon cycle de travail"
                sublabel="Changement de brigade, de régime ou d'horaires"
                onClick={() => setShowCycle(true)}
              />
            </Section>
          )}

          {/* Outils */}
          <Section teinte="violet" icon={<Wrench className="w-4 h-4" />} titre="Mes outils">
            <ClickableRow
              icon={<Calculator className="w-5 h-5" />}
              degrade={D.violet}
              label="Calculer les jours travaillés"
              sublabel="Sur une période, congés et CMO déduits"
              onClick={() => { setShowWorkedDays(true); track('tool_worked_days'); }}
            />
            <ClickableRow
              icon={<Sunset className="w-5 h-5" />}
              degrade={D.orange}
              label="Simuler mon départ à la retraite"
              sublabel="Tous compteurs soldés : à partir de quand cesser de travailler"
              onClick={() => { setShowRetraite(true); track('tool_retraite'); }}
            />
          </Section>

          {/* À propos */}
          <Section teinte="rose" icon={<Heart className="w-4 h-4" />} titre="À propos">
            <ClickableRow
              icon={<Share2 className="w-5 h-5" />}
              degrade={D.bleu}
              label="Recommander My Chronos à un collègue"
              sublabel="QR code à montrer, ou lien à envoyer"
              onClick={() => setShowRecommander(true)}
            />
            {avisStore && (
              <ClickableRow
                icon={<Star className="w-5 h-5" fill="currentColor" />}
                degrade={D.ambre}
                label={`Noter My Chronos sur ${nomStore}`}
                sublabel="Un avis aide d’autres collègues à trouver l’app"
                onClick={ouvrirFicheStore}
              />
            )}
            <ClickableRow
              icon={<DiscordLogo className="w-5 h-5" couleur="#FFFFFF" />}
              degrade={D.discord}
              label="Rejoindre la communauté Discord"
              sublabel="Idées, bugs, questions — avec Marco, l'assistant"
              onClick={ouvrirCommunaute}
            />
            <ClickableRow
              icon={<MessageSquareHeart className="w-5 h-5" />}
              degrade={D.rose}
              label="Donner mon avis / Signaler un bug"
              sublabel="Votre retour aide à améliorer l'app"
              onClick={() => { setShowFeedback(true); track('feedback_open'); }}
            />
            {onShowWelcome && (
              <ClickableRow
                icon={<Sparkles className="w-5 h-5" />}
                degrade={D.ciel}
                label="Revoir le message de bienvenue"
                onClick={onShowWelcome}
              />
            )}
            <ClickableRow
              icon={<Coffee className="w-5 h-5" />}
              degrade={D.orange}
              label="Soutenir le développement ☕"
              variant="ambre"
              onClick={() => { track('kofi_click'); window.open('https://ko-fi.com/mychronos', '_blank', 'noopener,noreferrer'); }}
            />
          </Section>

          {/* Confidentialité */}
          <Section teinte="turquoise" icon={<ShieldCheck className="w-4 h-4" />} titre="Confidentialité">
            <div className="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-2 px-3 py-3 rounded-xl border border-slate-200/80 bg-white shadow-sm text-center">
              <Pastille degrade={D.turquoise}><ShieldCheck className="w-5 h-5" /></Pastille>
              <div className="min-w-0">
                <div id="stats-toggle-label" className="text-[15px] font-semibold leading-snug text-slate-800">
                  Aider à améliorer l&apos;app
                </div>
                <div className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Envoie des statistiques anonymes (les fonctions utilisées). Jamais votre planning, ni qui vous êtes.{' '}
                  <Link href="/privacy#statistiques" className="underline hover:text-slate-700">
                    En savoir plus
                  </Link>
                </div>
              </div>
              <div className="justify-self-end flex flex-col items-center gap-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={statsEnabled}
                  aria-labelledby="stats-toggle-label"
                  onClick={toggleStats}
                  className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${statsEnabled ? 'bg-teal-600' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${statsEnabled ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
                <span className={`text-[11px] font-semibold ${statsEnabled ? 'text-teal-700' : 'text-slate-500'}`} aria-hidden="true">
                  {statsEnabled ? 'Activé' : 'Désactivé'}
                </span>
              </div>
            </div>
          </Section>

          {/* Zone danger */}
          <Section teinte="rouge" icon={<AlertTriangle className="w-4 h-4" />} titre="Zone de danger">
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogTrigger asChild>
                <button className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 w-full px-3 py-3 rounded-xl border border-rose-200 bg-white shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-150 text-center">
                  <Pastille degrade={D.rouge}><Trash2 className="w-5 h-5" /></Pastille>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-snug text-rose-700">Réinitialiser l&apos;application</span>
                    <span className="block text-xs mt-0.5 leading-snug text-rose-500">Supprime toutes les données — irréversible</span>
                  </span>
                  <ChevronRight className="justify-self-end w-5 h-5 text-rose-300" aria-hidden="true" />
                </button>
              </DialogTrigger>
              <DialogContent className="w-[92vw] max-w-sm rounded-2xl border-0 shadow-2xl p-0 overflow-y-auto overscroll-contain">
                <div className="px-5 pt-5 pb-4 bg-rose-50">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-rose-700">
                      <AlertTriangle className="w-5 h-5" />
                      Confirmer la réinitialisation
                    </DialogTitle>
                    <DialogDescription className="text-rose-600 text-sm mt-1">
                      Cette action supprimera toutes vos données (cycle, compteurs, historique). Irréversible.
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <DialogFooter className="px-5 py-4 gap-2 flex-row">
                  <Button
                    variant="outline"
                    onClick={() => setShowResetDialog(false)}
                    className="flex-1 rounded-xl border-slate-200"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleReset}
                    className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>

          {/* Sauvegarde — en dernier : transfert vers un nouvel appareil */}
          <Section teinte="vert" icon={<DatabaseBackup className="w-4 h-4" />} titre="Sauvegarde">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-semibold text-white shadow-md active:scale-[0.99] transition-all duration-150"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
              >
                <Download className="w-5 h-5" />
                Exporter
              </button>
              <button
                onClick={handleImportClick}
                disabled={isImporting}
                className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-emerald-500 bg-white text-[15px] font-semibold text-emerald-700 shadow-sm active:scale-[0.99] transition-all duration-150 disabled:opacity-50"
              >
                <Upload className="w-5 h-5" />
                {isImporting ? 'Import...' : 'Importer'}
              </button>
            </div>
            <p className="text-xs text-emerald-900/70 px-1 text-center">
              Exportez votre planning pour le réimporter sur un nouvel appareil (nouveau téléphone, etc.).
            </p>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </Section>

          {/* Version */}
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
            <div className="h-px flex-1 bg-slate-200" />
            <span>My Chronos v{APP_VERSION}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
      </div>

      {showFeedback && (
        <Suspense fallback={null}>
          <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
        </Suspense>
      )}

      {showCycle && onUpdateCycle && (
        <Dialog open={showCycle} onOpenChange={setShowCycle}>
          <DialogContent
            className="w-[95vw] max-w-lg p-0 rounded-2xl border-0 shadow-2xl overflow-hidden flex flex-col"
            style={{ height: '90vh', maxHeight: '90vh' }}
            showCloseButton={false}
          >
            <div className="shrink-0 px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <CalendarCog className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base font-bold leading-tight text-white">Modifier mon cycle</DialogTitle>
                  <p className="text-blue-200 text-xs mt-0.5">Vos compteurs et congés déjà posés sont conservés</p>
                </div>
                <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </DialogClose>
              </div>
              <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 bg-[#f8f9fc]">
              <ChangementCycle
                cycleConfig={cycleConfig}
                counters={counters}
                history={history}
                onCorriger={(config) => {
                  if (onUpdateCycle(config)) {
                    toast.success('Cycle mis à jour', {
                      description: 'Le calendrier a été recalculé. Vos compteurs et congés sont inchangés.',
                    });
                    setShowCycle(false);
                  } else {
                    toast.error('Impossible d\'enregistrer le nouveau cycle');
                  }
                }}
                onChanger={(p) => {
                  const r = onChangerCycle?.(p);
                  if (r && 'ok' in r) {
                    toast.success('Changement de cycle enregistré', {
                      description: 'Planning, droits de l’année et RPS recalculés.',
                    });
                    setShowCycle(false);
                  } else {
                    toast.error(r?.erreur ?? 'Impossible d\'enregistrer le changement');
                  }
                }}
                onAnnuler={() => {
                  if (onAnnulerChangementCycle?.()) {
                    toast.success('Changement de cycle annulé', { description: 'Votre ancien cycle et vos compteurs sont rétablis.' });
                    setShowCycle(false);
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showRecommander && <RecommanderModal onClose={() => setShowRecommander(false)} />}

      {showRetraite && (
        <Suspense fallback={null}>
          <RetraiteCalculator
            isOpen={showRetraite}
            onClose={() => setShowRetraite(false)}
            counters={counters}
            cycleConfig={cycleConfig}
            history={history}
          />
        </Suspense>
      )}

      {showWorkedDays && (
        <Suspense fallback={null}>
          <WorkedDaysCalculator
            isOpen={showWorkedDays}
            onClose={() => setShowWorkedDays(false)}
            cycleConfig={cycleConfig}
            history={history}
          />
        </Suspense>
      )}
    </div>
  );
}
