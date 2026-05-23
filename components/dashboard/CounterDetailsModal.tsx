'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Counters } from '@/lib/types';
import { formatMinutes } from '@/lib/calculations';
import {
  CA_TOTAL_ANNUEL,
  CF_TOTAL_ANNUEL,
  RTC_RESERVES_CET,
  CET_PLAFOND,
  ARTT_QUOTA_ANNUEL,
  HS_HISTORIQUE_TAUX_HORAIRE,
  CONGES_BONIFIES_QUOTA,
  CONGES_BONIFIES_EXPIRATION_MOIS,
  CONGES_BONIFIES_REPORT_MAX_MOIS,
} from '@/lib/constants';
import { AlertTriangle, Shield, TrendingUp, Info, Pencil, X } from 'lucide-react';

interface CounterDetailsModalProps {
  counterId: string | null;
  counters: Counters;
  onClose: () => void;
  onUpdate: (updates: Partial<Counters>) => void;
}

function Row({
  label,
  value,
  color = 'text-slate-700',
  bold = false,
  separator = false,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
  separator?: boolean;
}) {
  return (
    <>
      {separator && <div className="border-t border-slate-100 my-2" />}
      <div className="flex items-center justify-between py-1.5">
        <span className={`text-sm ${bold ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
          {label}
        </span>
        <span className={`text-sm font-medium ${color} ${bold ? 'text-base' : ''}`}>
          {value}
        </span>
      </div>
    </>
  );
}

function Alert({ text, type }: { text: string; type: 'warning' | 'error' | 'info' }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    error: 'bg-rose-50 border-rose-200 text-rose-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };
  const icons = {
    warning: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
    error: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
    info: <Info className="w-3.5 h-3.5 flex-shrink-0" />,
  };
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs mt-3 ${styles[type]}`}>
      {icons[type]}
      <span>{text}</span>
    </div>
  );
}

const TIME_COUNTERS = ['cf', 'rtc', 'rtcReserves', 'rps', 'hs', 'hsHistorique'];

export function CounterDetailsModal({ counterId, counters, onClose, onUpdate }: CounterDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputH, setInputH] = useState(0);
  const [inputM, setInputM] = useState(0);
  const [inputDays, setInputDays] = useState(0);

  const isTimeBased = counterId ? TIME_COUNTERS.includes(counterId) : false;

  useEffect(() => {
    if (!counterId) return;
    setIsEditing(false);

    const minutes = (() => {
      switch (counterId) {
        case 'cf': return counters.cf;
        case 'rtc':
        case 'rtcReserves': return counters.rtc;
        case 'rps': return counters.rps;
        case 'hs': return counters.hs;
        case 'hsHistorique': return counters.hsHistorique;
        default: return 0;
      }
    })();

    const days = (() => {
      switch (counterId) {
        case 'ca': return counters.ca;
        case 'caHP': return counters.caHP;
        case 'cet': return counters.cet;
        case 'artt': return counters.artt ?? 0;
        case 'caAnterieur': return counters.caAnterieur;
        case 'caHPAnterieur': return counters.caHPAnterieur;
        case 'cet2008': return counters.cet2008 ?? 0;
        case 'congesBonifies': return counters.congesBonifies ?? 0;
        default: return 0;
      }
    })();

    setInputH(Math.floor(minutes / 60));
    setInputM(minutes % 60);
    setInputDays(days);
  }, [counterId]);

  const handleSave = () => {
    if (!counterId) return;
    if (isTimeBased) {
      const newMinutes = Math.max(0, inputH * 60 + inputM);
      if (counterId === 'cf') onUpdate({ cf: newMinutes });
      else if (counterId === 'rtc' || counterId === 'rtcReserves') onUpdate({ rtc: newMinutes });
      else if (counterId === 'rps') onUpdate({ rps: newMinutes });
      else if (counterId === 'hs') onUpdate({ hs: newMinutes });
      else if (counterId === 'hsHistorique') onUpdate({ hsHistorique: newMinutes });
    } else {
      const newDays = Math.max(0, inputDays);
      if (counterId === 'ca') onUpdate({ ca: newDays });
      else if (counterId === 'caHP') onUpdate({ caHP: newDays });
      else if (counterId === 'cet') onUpdate({ cet: newDays });
      else if (counterId === 'artt') onUpdate({ artt: newDays });
      else if (counterId === 'caAnterieur') onUpdate({ caAnterieur: newDays });
      else if (counterId === 'caHPAnterieur') onUpdate({ caHPAnterieur: newDays });
      else if (counterId === 'cet2008') onUpdate({ cet2008: newDays });
      else if (counterId === 'congesBonifies') onUpdate({ congesBonifies: newDays });
    }
    setIsEditing(false);
  };

  const renderContent = () => {
    if (!counterId) return null;
    switch (counterId) {
      case 'cf': {
        const pris = CF_TOTAL_ANNUEL - counters.cf;
        return (
          <>
            <Row label="Crédit total annuel" value={formatMinutes(CF_TOTAL_ANNUEL)} />
            <Row label="Total consommé" value={formatMinutes(pris)} color="text-emerald-600" />
            <Row label="Solde disponible" value={formatMinutes(counters.cf)} bold color="text-blue-700" separator />
            <Alert type="info" text="Pensez à les répartir sur les deux semestres (~54h36 chacun) : en cas de mutation ou de départ en cours d'année, seuls les CF du semestre en cours sont pris en compte." />
            <Alert type="error" text="Les CF sont perdus au 31/12 s'ils ne sont pas consommés." />
          </>
        );
      }

      case 'rtcReserves':
      case 'rtc': {
        const reserves = RTC_RESERVES_CET;
        const rtcLibres = Math.max(0, counters.rtc - reserves);
        const reservesIntactes = counters.rtc >= reserves;
        return (
          <>
            <Row label="Solde actuel" value={formatMinutes(counters.rtc)} bold color="text-blue-700" />
            <Row label="Réservé pour CET" value={formatMinutes(reserves)} color="text-blue-600" separator />
            <Row label="RTC libres" value={formatMinutes(rtcLibres)} color={rtcLibres > 0 ? 'text-amber-600' : 'text-slate-400'} />
            {reservesIntactes
              ? <Alert type="info" text={`Les ${formatMinutes(reserves)} réservés CET sont intacts. Gain net : +37h50/an par rapport à une pose classique.`} />
              : <Alert type="error" text="⚠️ Les RTC réservés CET ont été entamés ! Cela réduit le gain annuel CET." />
            }
            <Alert type="warning" text="Les RTC libres sont perdus au 31/12 s'ils ne sont pas posés ou épargnés." />
          </>
        );
      }

      case 'ca': {
        const initial = CA_TOTAL_ANNUEL;
        const consommes = counters.caConsommes;
        const epargnesCET = Math.max(0, initial - counters.ca - consommes);
        return (
          <>
            <Row label="CA initial" value={`${initial}j`} />
            <Row label="Posés (congés pris)" value={`${consommes}j`} color="text-emerald-600" />
            <Row label="Épargnés au CET" value={`${epargnesCET}j`} color="text-blue-600" />
            <Row label="Disponible" value={`${counters.ca}j`} bold color="text-blue-700" separator />
            <Row label="CA HP obtenus" value={`${counters.caHP}j`} color={counters.caHP > 0 ? 'text-red-600' : 'text-slate-400'} />
            <Row label="Posés hors période" value={`${counters.caPosesHorsPeriode}j`} />
            <Alert type="warning" text="Les CA excédentaires (au-delà de 5) sont perdus au 31/12. Pensez à les poser ou à les épargner au CET." />
          </>
        );
      }

      case 'caHP': {
        return (
          <>
            <Row label="CA HP disponibles" value={`${counters.caHP}j`} bold color="text-red-700" />
            <Row label="CA posés hors période" value={`${counters.caPosesHorsPeriode}j`} />
            <Row label="Condition d'obtention" value="8 CA hors période" />
            <Alert type="info" text="Bonus de 2j si vous posez 8 CA hors période de forte demande (01/05–31/10). Ces jours peuvent être épargnés au CET." />
          </>
        );
      }

      case 'rps': {
        const anneePrec = counters.rpsAnneePrec;
        const accumuleCetteAnnee = Math.max(0, counters.rps - anneePrec);
        return (
          <>
            <Row label="Report année précédente" value={formatMinutes(anneePrec)} />
            <Row label="Accumulés cette année" value={formatMinutes(accumuleCetteAnnee)} color="text-emerald-600" />
            <Row label="Total disponible" value={formatMinutes(counters.rps)} bold color="text-blue-700" separator />
            <Alert type="info" text="Les RPS (dimanches, nuits, décalés) sont reportables indéfiniment. Réserve stratégique à conserver." />
          </>
        );
      }

      case 'hs': {
        const plafond = 9600;
        const pourcentage = Math.round((counters.hs / plafond) * 100);
        return (
          <>
            <Row label="HS stockées" value={formatMinutes(counters.hs)} bold color="text-blue-700" />
            <Row label="Plafond" value="160h" />
            <Row label="Utilisation" value={`${pourcentage}%`} color={pourcentage >= 90 ? 'text-rose-600' : 'text-slate-600'} />
            <Row label="Vers CET (max)" value="5 jours" separator />
            {pourcentage >= 90 && (
              <Alert type="error" text="Proche du plafond ! Au-delà de 160h, les HS supplémentaires sont obligatoirement payées." />
            )}
            <Alert type="info" text="Les HS sont reportables indéfiniment jusqu'au plafond de 160h." />
          </>
        );
      }

      case 'cet': {
        const manquantPlafond = Math.max(0, CET_PLAFOND - counters.cet);
        return (
          <>
            <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Compte Épargne Temps</span>
            </div>
            <Row label="Solde CET actuel" value={`${counters.cet}j`} bold color="text-blue-700" />
            <Row label="Plafond légal" value={`${CET_PLAFOND}j`} />
            <Row label="Marge disponible" value={manquantPlafond > 0 ? `${manquantPlafond}j` : '✓ Plafond atteint !'} color={manquantPlafond === 0 ? 'text-emerald-600' : 'text-blue-600'} separator />
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sources d'alimentation</p>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>RTC réservés : 10j/an (coût 83h30, gain +37h50)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>CA classiques : max 5j/an</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>CA HP : 2j/an (si bonus obtenu)</span>
              </div>
            </div>
          </>
        );
      }

      case 'caAnterieur': {
        const year = new Date().getFullYear();
        const deadline = new Date(year, 3, 30);
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <>
            <Row label="CA antérieurs disponibles" value={`${counters.caAnterieur}j`} bold color="text-amber-700" />
            <Row label="Deadline" value="30 avril" color="text-rose-600" />
            <Row label="Jours restants" value={daysLeft > 0 ? `${daysLeft}j` : 'Expiré !'} color={daysLeft > 0 ? 'text-amber-600' : 'text-rose-600'} />
            <Alert type="warning" text="Ces jours de l'année précédente doivent être consommés avant le 30 avril. Ils ne peuvent pas être convertis au CET." />
            {daysLeft <= 0 && <Alert type="error" text="La deadline est dépassée. Remettez ce compteur à 0." />}
          </>
        );
      }

      case 'caHPAnterieur': {
        const year = new Date().getFullYear();
        const deadline = new Date(year, 3, 30);
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <>
            <Row label="CA HP antérieurs disponibles" value={`${counters.caHPAnterieur}j`} bold color="text-orange-700" />
            <Row label="Origine" value="Bonus HP non consommé N-1" />
            <Row label="Deadline" value="30 avril" color="text-rose-600" />
            <Row label="Jours restants" value={daysLeft > 0 ? `${daysLeft}j` : 'Expiré !'} color={daysLeft > 0 ? 'text-orange-600' : 'text-rose-600'} />
            <Alert type="warning" text="Bonus CA HP reporté de l'année précédente. Deadline 30 avril. Non convertible au CET." />
          </>
        );
      }

      case 'artt': {
        const year = new Date().getFullYear();
        const daysLeft = Math.ceil((new Date(year, 11, 31).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <>
            <Row label="ARTT disponibles" value={`${counters.artt ?? 0}j`} bold color="text-slate-700" />
            <Row label="Quota annuel" value={`${ARTT_QUOTA_ANNUEL}j`} />
            <Row label="Deadline" value="31 décembre" color="text-rose-600" separator />
            <Row label="Jours restants" value={`${daysLeft}j`} color={daysLeft <= 60 ? 'text-amber-600' : 'text-slate-600'} />
            <Alert type="warning" text="Les ARTT non consommés au 31/12 sont perdus définitivement (ou à transférer au CET avant le 1er février de l'année suivante)." />
            <Alert type="info" text="Arrêté du 3 mai 2002 — police nationale (20j/an). Distinctif des RTC (repos cycliques)." />
          </>
        );
      }

      case 'cet2008': {
        return (
          <>
            <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">CET Historique 2008</span>
            </div>
            <Row label="Stock disponible" value={`${counters.cet2008 ?? 0}j`} bold color="text-blue-700" />
            <Row label="Statut" value="Gelé depuis janv. 2020" />
            <Row label="Deadline" value="Aucune (jusqu'à la retraite)" separator />
            <Alert type="info" text="Ce CET a été constitué avant le 31/12/2009 (décret 2002-634). Il ne peut plus être alimenté depuis le 1er janvier 2010 (décret 2009-1065). Utilisable librement en congés." />
            <Alert type="warning" text="Les jours non consommés sont perdus à la retraite (pas de conversion retraite possible contrairement au CET courant)." />
          </>
        );
      }

      case 'congesBonifies': {
        const ouverture = counters.congesBonifiesDateOuverture
          ? new Date(counters.congesBonifiesDateOuverture)
          : null;
        const maxExpiration = ouverture
          ? (() => { const d = new Date(ouverture); d.setMonth(d.getMonth() + CONGES_BONIFIES_EXPIRATION_MOIS + CONGES_BONIFIES_REPORT_MAX_MOIS); return d; })()
          : null;
        const daysLeft = maxExpiration ? Math.ceil((maxExpiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
        return (
          <>
            <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Congés Bonifiés DOM/TOM</span>
            </div>
            <Row label="Jours disponibles" value={`${counters.congesBonifies ?? 0}j`} bold color="text-emerald-700" />
            <Row label="Quota" value={`${CONGES_BONIFIES_QUOTA}j (décret 2020-851)`} />
            {ouverture && <Row label="Ouverture du droit" value={ouverture.toLocaleDateString('fr-FR')} />}
            {maxExpiration && <Row label="Expiration max" value={maxExpiration.toLocaleDateString('fr-FR')} color={daysLeft && daysLeft <= 90 ? 'text-rose-600' : 'text-slate-600'} />}
            {daysLeft !== null && <Row label="Jours restants" value={`${daysLeft}j`} color={daysLeft <= 90 ? 'text-rose-600' : 'text-emerald-600'} separator />}
            <Alert type="info" text="Droit tous les 24 mois. Expire 36 mois après ouverture du droit + 12 mois de report max (48 mois au total). Prise en charge transport aller-retour." />
          </>
        );
      }

      case 'hsHistorique': {
        const indemnisation = (counters.hsHistorique / 60 * HS_HISTORIQUE_TAUX_HORAIRE).toFixed(2);
        return (
          <>
            <Row label="Stock historique" value={formatMinutes(counters.hsHistorique)} bold color="text-rose-700" />
            <Row label="Valeur indicative" value={`~${indemnisation} €`} color="text-rose-600" />
            <Row label="Taux indemnisation" value={`${HS_HISTORIQUE_TAUX_HORAIRE} €/h brut`} separator />
            <Row label="Deadline légale" value="Aucune" />
            <Alert type="info" text="Stock constitué avant le 1er janvier 2020 (arrêté APORTT du 5 sept. 2019). Ce compte est gelé : plus aucune alimentation depuis 2020. Récupération sur ordre de service ou indemnisation lors des campagnes (décret 2020-1398)." />
            <Alert type="warning" text="Ces heures sont perdues à la retraite si non récupérées ni indemnisées. Aucune conversion retraite possible." />
          </>
        );
      }

      default:
        return <p className="text-sm text-slate-500">Aucun détail disponible.</p>;
    }
  };

  const titles: Record<string, string> = {
    cf: 'Crédits Fériés',
    rtc: 'RTC Libres',
    rtcReserves: 'RTC Réservés CET',
    ca: 'Congés Annuels',
    caHP: 'CA Hors Période',
    rps: 'RPS',
    hs: 'Heures Sup',
    cet: 'CET',
    caAnterieur: 'CA Antérieurs (N-1)',
    caHPAnterieur: 'CA HP Antérieurs (N-1)',
    artt: 'ARTT',
    cet2008: 'CET 2008',
    congesBonifies: 'Congés Bonifiés',
    hsHistorique: 'HS Historique',
  };

  return (
    <Dialog open={!!counterId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-sm bg-background border-slate-200" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {counterId ? (titles[counterId] ?? 'Détails') : ''}
            </DialogTitle>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="pt-1 pb-2 max-h-[60vh] overflow-y-auto">
          {renderContent()}
        </div>

        {/* Section modification */}
        {counterId && ['cf', 'rtc', 'rtcReserves', 'rps', 'hs', 'hsHistorique', 'ca', 'caHP', 'cet', 'artt', 'caAnterieur', 'caHPAnterieur', 'cet2008', 'congesBonifies'].includes(counterId) && (
          <div className="pt-3 border-t border-slate-100">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="w-full border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300"
              >
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Modifier la valeur
              </Button>
            ) : (
              <div className="space-y-3">
                <Label className="text-xs text-slate-500">
                  {isTimeBased ? 'Nouvelle valeur' : 'Nombre de jours'}
                </Label>
                {isTimeBased ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        type="number"
                        min={0}
                        value={inputH || ''}
                        placeholder="0"
                        inputMode="numeric"
                        aria-label="Heures"
                        onChange={(e) => setInputH(parseInt(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-slate-500" aria-hidden="true">h</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={inputM || ''}
                        placeholder="0"
                        inputMode="numeric"
                        aria-label="Minutes"
                        onChange={(e) => setInputM(Math.min(59, parseInt(e.target.value) || 0))}
                        onFocus={(e) => e.target.select()}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-slate-500" aria-hidden="true">min</span>
                    </div>
                  </div>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    value={inputDays || ''}
                    placeholder="0"
                    inputMode="numeric"
                    aria-label="Nombre de jours"
                    onChange={(e) => setInputDays(parseInt(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    className="w-28 text-center"
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
