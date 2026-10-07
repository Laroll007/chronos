'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, PiggyBank, X } from 'lucide-react';
import type { Counters, UserData } from '@/lib/types';
import { planEpargneCET, type ApportCET } from '@/lib/cet';
import { formatMinutes } from '@/lib/calculations';
import {
  CET_PLAFOND,
  CET_PLAFOND_DEROGATOIRE,
  CET_PROGRESSION_ANNUELLE_MAX,
  CET_SEUIL_OPTION,
  HS_COUT_PAR_JOUR_CET,
  HS_MAX_VERS_CET,
  RTC_COUT_PAR_JOUR_CET,
  RTC_JOURS_CET_CONSEILLES,
  RTC_GAIN_PAR_JOUR,
} from '@/lib/constants';

interface CETPlanModalProps {
  userData: UserData;
  onClose: () => void;
  /** Janvier : enregistre le versement demandé (conseillé, ou maximum avec surplus indemnisé). */
  onRecord: (avecSurplus: boolean) => { success: boolean; error?: string };
  /** Réglage « ce que je garde pour le CET » (RTC / HS). */
  onUpdateCounters?: (updates: Partial<Counters>) => unknown;
}

function lignesApport(apport: ApportCET, janvier: boolean) {
  return [
    apport.rtc > 0 && {
      key: 'rtc',
      label: `${apport.rtc} jour${apport.rtc > 1 ? 's' : ''} de RTC`,
      detail: `${formatMinutes(apport.rtc * RTC_COUT_PAR_JOUR_CET)} de RTC — le plus avantageux : 8h21 par jour au lieu d’une journée entière, soit ${formatMinutes(apport.rtc * RTC_GAIN_PAR_JOUR)} gagnées`,
    },
    apport.artt > 0 && {
      key: 'artt',
      label: `${apport.artt} jour${apport.artt > 1 ? 's' : ''} d’ARTT`,
      detail: janvier ? 'ARTT restants de l’année écoulée' : 'Perdus au 31 décembre s’ils ne sont ni posés ni versés',
    },
    apport.rtt > 0 && {
      key: 'rtt',
      label: `${apport.rtt} jour${apport.rtt > 1 ? 's' : ''} de RTT`,
      detail: janvier ? 'RTT restants de l’année écoulée' : 'Perdus au 31 décembre s’ils ne sont ni posés ni versés',
    },
    apport.caHP > 0 && {
      key: 'caHP',
      label: `${apport.caHP} jour${apport.caHP > 1 ? 's' : ''} de CA HP`,
      detail: janvier ? 'CA HP de l’année écoulée' : 'Vos CA hors période',
    },
    apport.ca > 0 && {
      key: 'ca',
      label: `${apport.ca} jour${apport.ca > 1 ? 's' : ''} de CA`,
      detail: `${janvier ? 'CA de l’année écoulée' : 'À garder d’ici au 31 décembre'} — 5 jours maximum par an`,
    },
    apport.hs > 0 && {
      key: 'hs',
      label: `${apport.hs} jour${apport.hs > 1 ? 's' : ''} d’HS`,
      detail: `${formatMinutes(apport.hs * HS_COUT_PAR_JOUR_CET)} d’heures supplémentaires (8h21 par jour)`,
    },
  ].filter(Boolean) as { key: string; label: string; detail: string }[];
}

const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

/**
 * « Mon épargne CET » : combien verser, et quels congés, dans l'ordre le plus
 * avantageux. Estimation le reste de l'année, plan réel en janvier.
 *
 * Deux montants : le versement conseillé (tout reste sur le CET) et le
 * versement maximal, dont le surplus est indemnisé ou versé à la RAFP.
 */
export function CETPlanModal({ userData, onClose, onRecord, onUpdateCounters }: CETPlanModalProps) {
  const plan = useMemo(() => planEpargneCET(userData), [userData]);
  const [error, setError] = useState<string | null>(null);
  // CET au plafond : seul un versement indemnisé reste possible.
  const [avecSurplus, setAvecSurplus] = useState(() => plan.apport.total === 0);
  const { apport, capacite, maximum, indemnises } = plan;
  const cet = userData.counters.cet;
  const gele = cet > CET_PLAFOND;
  const janvier = plan.mode === 'janvier';
  const c = userData.counters;
  const verse = avecSurplus ? maximum : apport;
  // L'avertissement sur le seuil de CA n'a de sens que s'il change le résultat :
  // des CA figurent dans l'estimation, ou (janvier) il en reste qui auraient
  // pu compléter le versement.
  const caConcernes = janvier
    ? apport.total < capacite && c.caAnterieur + c.caHPAnterieur > 0
    : maximum.ca + maximum.caHP > 0;

  const lignes = lignesApport(apport, janvier);
  const surplus = indemnises > 0;

  const record = () => {
    const res = onRecord(avecSurplus);
    if (res.success) onClose();
    else setError(res.error ?? 'Enregistrement impossible');
  };

  // Ce que le CET peut garder, expliqué selon la situation de l'agent.
  const regleConservation =
    cet < CET_SEUIL_OPTION
      ? `Votre CET peut monter jusqu’à ${CET_SEUIL_OPTION} jours, puis ${CET_PROGRESSION_ANNUELLE_MAX} de plus par an (${CET_PLAFOND} au total).`
      : `Au-delà de ${CET_SEUIL_OPTION} jours, votre CET ne progresse que de ${CET_PROGRESSION_ANNUELLE_MAX} jours par an (${CET_PLAFOND} au total).`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-md p-0 rounded-2xl border-0 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        showCloseButton={false}
      >
        <div className="shrink-0 px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <PiggyBank className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold leading-tight text-white">Mon épargne CET</DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">
                CET actuel : {cet} j{cet <= CET_PLAFOND && ` sur ${CET_PLAFOND} j`}
              </p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {gele ? (
            <p className="text-sm text-slate-700">
              Votre CET ({cet} jours) dépasse le plafond habituel de {CET_PLAFOND} jours, grâce aux
              relèvements exceptionnels (COVID, JOP 2024) qui permettent d’aller jusqu’à{' '}
              {CET_PLAFOND_DEROGATOIRE} jours : vos jours sont conservés, mais le compte est gelé et ne
              peut plus être alimenté tant qu’il reste au-dessus de {CET_PLAFOND} jours.
            </p>
          ) : maximum.total === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun solde ne peut alimenter le CET pour l&apos;instant (RTC, CA, CA HP ou HS).
            </p>
          ) : (
            <>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm text-slate-700">
                  {janvier
                    ? <>Au titre de {plan.anneeConges}, versement conseillé :</>
                    : <>En janvier {plan.anneeVersement}, versement conseillé :</>}
                </p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{jours(apport.total)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {capacite === 0
                    ? `Votre CET est au plafond de ${CET_PLAFOND} jours : tout versement serait indemnisé ou versé à la RAFP.`
                    : `${regleConservation} Ces jours restent sur votre CET.`}
                </p>
              </div>

              {onUpdateCounters && (
                <ReglageGarde counters={c} capacite={capacite} onUpdate={onUpdateCounters} />
              )}

              {lignes.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-2">
                    {janvier ? 'À demander (GesTT ou service de gestion)' : 'Le plus avantageux'}
                  </p>
                  <ul className="space-y-2">
                    {lignes.map((l) => (
                      <li key={l.key} className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-800">{l.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{l.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {surplus && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Vous pouvez verser jusqu’à {jours(maximum.total)}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {maximum.rtc > apport.rtc && `Soit ${maximum.rtc} jours de RTC au total (${formatMinutes(maximum.rtc * RTC_COUT_PAR_JOUR_CET)}). `}
                      Mais votre CET ne peut en garder que {jours(capacite)} : les{' '}
                      <strong>{jours(indemnises)}</strong> de plus sont{' '}
                      <strong>payés</strong> (indemnisation forfaitaire par jour, selon votre catégorie)
                      ou versés à la <strong>RAFP</strong> (retraite additionnelle — d’office si vous ne
                      choisissez pas). Ils ne reviennent pas en congés.
                    </p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Conseil : en versant {jours(apport.total)}, vous ne perdez aucune heure — tout reste
                    en congés sur votre CET. Le surplus n’a d’intérêt que si vous préférez être payé.
                  </p>
                </div>
              )}

              {!plan.conditionCA.ok && caConcernes && (
                <p className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Pour verser des CA, il faut en avoir pris au moins {plan.conditionCA.seuil}{' '}
                    dans l&apos;année ({plan.conditionCA.poses} posés en {plan.anneeConges}).
                    {!janvier && ' Ils sont comptés dans l’estimation si vous atteignez ce seuil d’ici au 31 décembre.'}
                  </span>
                </p>
              )}

              {plan.reliquatRTCInconnu && (
                <p className="text-xs text-slate-500">
                  Vos RTC restants au 31 décembre ne sont pas connus de l&apos;app (inscription
                  récente) : ils ne sont pas comptés ici. Vérifiez-les sur votre relevé de compteurs.
                </p>
              )}

              {janvier && surplus && apport.total > 0 && (
                <div className="space-y-2" role="radiogroup" aria-label="Versement demandé">
                  <p className="text-sm font-semibold text-slate-800">Vous avez demandé :</p>
                  {[
                    { v: false, label: `Le versement conseillé (${jours(apport.total)})` },
                    { v: true, label: `Le maximum (${jours(maximum.total)}, dont ${indemnises} indemnisés ou RAFP)` },
                  ].map((o) => (
                    <label key={String(o.v)} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="versement-cet"
                        checked={avecSurplus === o.v}
                        onChange={() => setAvecSurplus(o.v)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-500">
                {janvier
                  ? 'Faites la demande avant le 31 janvier (GesTT ou service de gestion), puis enregistrez-la ici pour mettre vos compteurs à jour.'
                  : `Le versement se demande (GesTT ou service de gestion) du 1er au 31 janvier ${plan.anneeVersement}. D’ici là, gardez ces soldes de côté plutôt que de les poser.`}
              </p>
            </>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Fermer
          </button>
          {janvier && !gele && verse.total > 0 && (
            <button
              type="button"
              onClick={record}
              className="flex-[2] h-11 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 100%)' }}
            >
              <CheckCircle2 className="w-4 h-4" />
              J&apos;ai fait ma demande
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * « Ce que je garde pour le CET » : nombre de jours de RTC et d'HS que l'agent
 * met de côté (9 RTC au lieu de 10, 2 ou 3 selon la place restante…). Ces
 * heures ne sont plus proposées à la pose et passent en tête du versement.
 */
function ReglageGarde({
  counters,
  capacite,
  onUpdate,
}: {
  counters: Counters;
  capacite: number;
  onUpdate: (updates: Partial<Counters>) => unknown;
}) {
  const rtcAuto = counters.rtcJoursCET === undefined;
  const rtc = counters.rtcJoursCET ?? RTC_JOURS_CET_CONSEILLES;
  const hs = counters.hsJoursCET ?? 0;
  const champ = (
    id: string,
    label: string,
    value: number,
    max: number,
    onChange: (v: number) => void,
    detail: string
  ) => (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="flex-1 text-sm text-slate-700">
        {label}
        <span className="block text-xs text-slate-500">{detail}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))}
        className="w-16 h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-center"
      />
      <span className="text-sm text-slate-500">j</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Ce que je garde pour le CET</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Ces heures ne vous seront plus proposées quand vous posez des congés, et passent en premier
          dans le versement de janvier.{capacite > 0 && ` Votre CET peut encore garder ${capacite} jour${capacite > 1 ? 's' : ''} sans indemnisation.`}
        </p>
      </div>
      {counters.hasRTC !== false &&
        champ('garde-rtc', 'RTC', rtc, 40, (v) => onUpdate({ rtcJoursCET: v }),
          `${formatMinutes(rtc * RTC_COUT_PAR_JOUR_CET)} à 8h21 le jour${rtcAuto ? ' · réglage conseillé' : ''}`)}
      {champ('garde-hs', 'Heures supplémentaires', hs, HS_MAX_VERS_CET, (v) => onUpdate({ hsJoursCET: v }),
        `${formatMinutes(hs * HS_COUT_PAR_JOUR_CET)} · 5 jours maximum`)}
      {!rtcAuto && (
        <button
          type="button"
          onClick={() => onUpdate({ rtcJoursCET: undefined })}
          className="text-xs font-medium text-blue-700 hover:text-blue-800"
        >
          Revenir au réglage conseillé (10 jours de RTC)
        </button>
      )}
    </div>
  );
}
