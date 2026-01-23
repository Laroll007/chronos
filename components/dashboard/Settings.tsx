'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Counters, CycleConfig, HistoryEntry } from '@/lib/types';
import { downloadExport, importData, resetAllData } from '@/lib/storage';
import { formatMinutes } from '@/lib/calculations';
import { openPDFReport, PDFReportData } from '@/lib/export-pdf';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FileText,
  PiggyBank,
} from 'lucide-react';
import { toast } from 'sonner';
import { HistoryChart } from './HistoryChart';

interface SettingsProps {
  counters: Counters;
  cycleConfig: CycleConfig;
  history: HistoryEntry[];
  onUpdateCounters: (updates: Partial<Counters>) => void;
  onReset: () => void;
}

export function Settings({
  counters,
  cycleConfig,
  history,
  onUpdateCounters,
  onReset,
}: SettingsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Données pour export PDF
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
      toast.success('Rapport généré', {
        description: 'Utilisez Ctrl+P pour sauvegarder en PDF',
      });
    } catch {
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const handleExportCETPDF = () => {
    try {
      openPDFReport('cet', getPDFData());
      toast.success('Récapitulatif CET généré', {
        description: 'Utilisez Ctrl+P pour sauvegarder en PDF',
      });
    } catch {
      toast.error('Erreur lors de la génération');
    }
  };

  const handleExport = () => {
    try {
      downloadExport();
      toast.success('Export réussi', {
        description: 'Fichier téléchargé',
      });
    } catch (error) {
      toast.error('Erreur lors de l export');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const result = importData(text, false);

      if (result.success) {
        toast.success('Import réussi', {
          description: 'Données chargées',
        });
        window.location.reload();
      } else {
        toast.error('Erreur d import', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Erreur lors de la lecture du fichier');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleReconfigure = () => {
    router.push('/onboarding');
  };

  return (
    <Card className="glass border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-slate-400" />
          Paramètres
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Objectif CET */}
        <div>
          <Label>Objectif CET fin d année</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              min={counters.cet}
              max={60}
              value={counters.objectifCET}
              onChange={(e) =>
                onUpdateCounters({ objectifCET: parseInt(e.target.value) || 15 })
              }
              className="w-24 bg-white/5"
            />
            <span className="text-muted-foreground">jours</span>
          </div>
        </div>

        {/* Info cycle */}
        <div className="p-4 rounded-lg bg-white/5">
          <div className="text-sm font-medium mb-2">Cycle actuel</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Type: {cycleConfig.type === 'alterne' ? 'Alterné A/B' : 'Hebdomadaire'}</div>
            <div>Durée journée: {formatMinutes(cycleConfig.heuresParJour)}</div>
            <div>
              Date référence:{' '}
              {new Date(cycleConfig.dateDebutCycle).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full bg-white/5 border-white/10"
            onClick={handleReconfigure}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconfigurer
          </Button>
        </div>

        {/* Export/Import */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Sauvegarde</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="bg-white/5 border-white/10"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <Button
              variant="outline"
              className="bg-white/5 border-white/10"
              onClick={handleImportClick}
              disabled={isImporting}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? 'Import...' : 'Importer'}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Exportez vos données pour les sauvegarder ou les transférer sur un autre appareil.
          </p>
        </div>

        {/* Graphique évolution */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Évolution des compteurs</div>
          <HistoryChart history={history} currentCounters={counters} />
        </div>

        {/* Export PDF */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Rapports PDF</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="bg-white/5 border-white/10"
              onClick={handleExportAnnualPDF}
            >
              <FileText className="w-4 h-4 mr-2" />
              Rapport annuel
            </Button>
            <Button
              variant="outline"
              className="bg-white/5 border-white/10"
              onClick={handleExportCETPDF}
            >
              <PiggyBank className="w-4 h-4 mr-2" />
              Récap CET
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Générez un rapport imprimable avec vos soldes et historique.
          </p>
        </div>

        {/* Réinitialisation */}
        <div className="pt-4 border-t border-white/10">
          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Réinitialiser l application
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-white/10">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  Confirmer la réinitialisation
                </DialogTitle>
                <DialogDescription>
                  Cette action supprimera toutes vos données : configuration du cycle,
                  compteurs et historique. Cette action est irréversible.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                  className="bg-white/5 border-white/10"
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReset}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Réinitialiser
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          Chronos v1.0.0
        </div>
      </CardContent>
    </Card>
  );
}
