'use client';

import { useState, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
import { Counters, CycleConfig, HistoryEntry } from '@/lib/types';
import { downloadExport, importData, resetAllData } from '@/lib/storage';
import { formatMinutes } from '@/lib/calculations';
import { openPDFReport, PDFReportData } from '@/lib/export-pdf';
import { generateICS, downloadICS, ExportType } from '@/lib/export-ics';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FileText,
  PiggyBank,
  MessageCircle,
  MessageSquarePlus,
  Coffee,
  CalendarDays,
  ChevronRight,
  Cpu,
  Database,
  Heart,
  Clock,
  Briefcase,
  BedDouble,
  CalendarCheck2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const FeedbackModal = lazy(() =>
  import('@/components/dashboard/FeedbackModal').then((m) => ({ default: m.FeedbackModal }))
);

// ─── Sous-composants de mise en page ─────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  action,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  action: React.ReactNode;
  variant?: 'default' | 'amber' | 'danger';
}) {
  const bgClass =
    variant === 'amber'
      ? 'bg-amber-50 border-amber-200'
      : variant === 'danger'
      ? 'bg-rose-50 border-rose-200'
      : 'bg-slate-50 border-slate-200';

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${bgClass}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${variant === 'danger' ? 'text-rose-700' : variant === 'amber' ? 'text-amber-700' : 'text-slate-700'}`}>
            {label}
          </div>
          {sublabel && <div className="text-xs text-slate-400 truncate mt-0.5">{sublabel}</div>}
        </div>
      </div>
      <div className="shrink-0 ml-3">{action}</div>
    </div>
  );
}

function ClickableRow({
  icon,
  label,
  sublabel,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant?: 'default' | 'amber';
}) {
  const baseClass =
    variant === 'amber'
      ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
      : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-200';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border w-full text-left transition-all duration-150 group ${baseClass}`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${variant === 'amber' ? 'text-amber-700' : 'text-slate-700'}`}>
          {label}
        </div>
        {sublabel && <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors shrink-0" aria-hidden="true" />
    </button>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface SettingsProps {
  counters: Counters;
  cycleConfig: CycleConfig;
  history: HistoryEntry[];
  onUpdateCounters: (updates: Partial<Counters>) => void;
  onReset: () => void;
  onShowWelcome?: () => void;
}

export function Settings({
  counters,
  cycleConfig,
  history,
  onUpdateCounters,
  onReset,
  onShowWelcome,
}: SettingsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const getPDFData = (): PDFReportData => ({
    counters,
    cycleConfig,
    history,
    generatedAt: new Date(),
    year: new Date().getFullYear(),
  });

  const handleExportAnnualPDF = () => {
    try {
      openPDFReport('annual', getPDFData());
      toast.success('Rapport généré', { description: 'Utilisez Ctrl+P pour sauvegarder en PDF' });
    } catch {
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const handleExportCETPDF = () => {
    try {
      openPDFReport('cet', getPDFData());
      toast.success('Récapitulatif CET généré', { description: 'Utilisez Ctrl+P pour sauvegarder en PDF' });
    } catch {
      toast.error('Erreur lors de la génération');
    }
  };

  const handleExportICS = (type: ExportType) => {
    try {
      const year = new Date().getFullYear();
      const content = generateICS(cycleConfig, history, type, year);
      const suffix = type === 'all' ? 'planning' : type === 'work' ? 'travail' : type === 'rest' ? 'repos' : 'conges';
      downloadICS(content, `MyChronos-${suffix}-${year}.ics`);
      toast.success('Export calendrier réussi');
    } catch {
      toast.error("Erreur lors de l'export calendrier");
    }
  };

  const handleExport = () => {
    try {
      downloadExport();
      toast.success('Sauvegarde téléchargée');
    } catch {
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
            <p className="text-blue-200 text-xs mt-0.5">Configuration et exports</p>
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
        <div className="px-5 py-5 space-y-6">

          {/* Cycle */}
          <section className="space-y-2.5">
            <SectionLabel icon={<Cpu className="w-3 h-3 text-blue-600" />} label="Cycle de travail" />
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <InfoRow
                label="Type"
                value={cycleConfig.type === 'alterne' ? 'Alterné A/B' : 'Hebdomadaire'}
              />
              <div className="h-px bg-slate-200" />
              <InfoRow label="Durée journée" value={formatMinutes(cycleConfig.heuresParJour)} />
              <div className="h-px bg-slate-200" />
              <InfoRow
                label="Date de référence"
                value={new Date(cycleConfig.dateDebutCycle).toLocaleDateString('fr-FR')}
              />
            </div>
            <button
              onClick={() => router.push('/onboarding')}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all duration-150"
            >
              <RefreshCw className="w-4 h-4" />
              Reconfigurer le cycle
            </button>
          </section>

          {/* Sauvegarde */}
          <section className="space-y-2.5">
            <SectionLabel icon={<Database className="w-3 h-3 text-emerald-600" />} label="Sauvegarde" />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all duration-150"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
              <button
                onClick={handleImportClick}
                disabled={isImporting}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-150 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Import...' : 'Importer'}
              </button>
            </div>
            <p className="text-xs text-slate-400 px-1">
              Sauvegardez ou transférez vos données vers un autre appareil.
            </p>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </section>


          {/* Exports */}
          <section className="space-y-2.5">
            <SectionLabel icon={<FileText className="w-3 h-3 text-rose-600" />} label="Rapports PDF" />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportAnnualPDF}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all duration-150"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">Rapport annuel</span>
              </button>
              <button
                onClick={handleExportCETPDF}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all duration-150"
              >
                <PiggyBank className="w-4 h-4 shrink-0" />
                <span className="truncate">Récap CET</span>
              </button>
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel icon={<CalendarDays className="w-3 h-3 text-blue-600" />} label="Export calendrier .ics" />
            <div className="space-y-1.5">
              <ClickableRow
                icon={<Briefcase className="w-4 h-4 text-blue-500 shrink-0" />}
                label="Jours travaillés"
                sublabel="Toutes les plages de travail de l'année"
                onClick={() => handleExportICS('work')}
              />
              <ClickableRow
                icon={<BedDouble className="w-4 h-4 text-slate-400 shrink-0" />}
                label="Jours de repos"
                sublabel="Toutes les plages de repos de l'année"
                onClick={() => handleExportICS('rest')}
              />
              <ClickableRow
                icon={<Clock className="w-4 h-4 text-emerald-500 shrink-0" />}
                label="Congés posés"
                sublabel="Congés enregistrés dans l'historique"
                onClick={() => handleExportICS('leaves')}
              />
              <button
                onClick={() => handleExportICS('all')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 w-full text-left transition-all duration-150 group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
                  <CalendarCheck2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-700">Tout exporter</div>
                  <div className="text-xs text-blue-500">Planning complet combiné</div>
                </div>
                <Download className="w-4 h-4 text-blue-400 shrink-0" />
              </button>
            </div>
            <p className="text-xs text-slate-400 px-1">
              Compatible Google Calendar, Apple Calendar, Outlook. Sur iOS/Android, s&apos;ouvre directement dans le Calendrier.
            </p>
          </section>

          {/* À propos */}
          <section className="space-y-2.5">
            <SectionLabel icon={<Heart className="w-3 h-3 text-pink-500" />} label="À propos" />
            <div className="space-y-1.5">
              <ClickableRow
                icon={<MessageSquarePlus className="w-4 h-4 text-blue-500 shrink-0" />}
                label="Donner mon avis / Signaler un bug"
                sublabel="Votre retour aide à améliorer l'app"
                onClick={() => setShowFeedback(true)}
              />
              {onShowWelcome && (
                <ClickableRow
                  icon={<MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                  label="Revoir le message de bienvenue"
                  onClick={onShowWelcome}
                />
              )}
              <button
                onClick={() => window.open('https://ko-fi.com/mychronos', '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 w-full text-left transition-all duration-150 group"
              >
                <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-amber-700">Soutenir le développement ☕</div>
                  <div className="text-xs text-amber-500">My Chronos est gratuit et le restera.</div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-300 group-hover:text-amber-500 transition-colors shrink-0" />
              </button>
            </div>
          </section>

          {/* Zone danger */}
          <section className="space-y-2.5">
            <SectionLabel icon={<AlertTriangle className="w-3 h-3 text-rose-500" />} label="Zone de danger" />
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 w-full text-left transition-all duration-150">
                  <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-rose-700">Réinitialiser l&apos;application</div>
                    <div className="text-xs text-rose-400">Supprime toutes les données — irréversible</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-300 shrink-0" />
                </button>
              </DialogTrigger>
              <DialogContent className="w-[92vw] max-w-sm rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
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
          </section>

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
    </div>
  );
}
