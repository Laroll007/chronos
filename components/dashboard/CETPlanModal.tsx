'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, PiggyBank, X } from 'lucide-react';
import type { UserData } from '@/lib/types';
import { planEpargneCET } from '@/lib/cet';
import { formatMinutes } from '@/lib/calculations';
import { CET_PLAFOND, RTC_GAIN_PAR_JOUR } from '@/lib/constants';

interface CETPlanModalProps {
  userData: UserData;
  onClose: () => void;
  /** Janvier : enregistre le versement demandé dans GesTT. */
  onRecord: () => { success: boolean; error?: string };
}

/**
 * « Mon épargne CET » : combien verser, et quels congés, dans l'ordre le plus
 * avantageux. Estimation le reste de l'année, plan réel en janvier.
 */
export function CETPlanModal({ userData, onClose, onRecord }: CETPlanModalProps) {
  const plan = useMemo(() => planEpargneCET(userData), [userData]);
  const [error, setError] = useState<string | null>(null);
  const { apport, capacite } = plan;
  const cet = userData.counters.cet;
  const janvier = plan.mode === 'janvier';
  const c = userData.counters;
  // L'avertissement sur le seuil de CA n'a de sens que s'il change le résultat :
  // des CA figurent dans l'estimation, ou (janvier) il en reste qui auraient
  // pu compléter le versement.
  const caConcernes = janvier
    ? apport.total < capacite && c.caAnterieur + c.caHPAnterieur > 0
    : apport.ca + apport.caHP > 0;

  const lignes = [
    apport.rtc > 0 && {
      key: 'rtc',
      label: `${apport.rtc} jour${apport.rtc > 1 ? 's' : ''} de RTC`,
      detail: `${formatMinutes(plan.rtcMinutes)} de RTC — le plus avantageux : 8h21 par jour au lieu de 12h08, soit ${formatMinutes(apport.rtc * RTC_GAIN_PAR_JOUR)} gagnées`,
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
      detail: `${formatMinutes(plan.hsMinutes)} d’heures supplémentaires (8h21 par jour)`,
    },
  ].filter(Boolean) as { key: string; label: string; detail: string }[];

  const record = () => {
    const res = onRecord();
    if (res.success) onClose();
    else setError(res.error ?? 'Enregistrement impossible');
  };

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
          {capacite === 0 ? (
            <p className="text-sm text-slate-700">
              {cet > CET_PLAFOND
                ? `Votre CET (${cet} jours) dépasse le plafond habituel de ${CET_PLAFOND} jours, grâce à un relèvement exceptionnel : vos jours sont conservés, mais l’app ne propose pas de nouveau versement. En cas de doute, vérifiez dans GesTT.`
                : `Votre CET a atteint le plafond de ${CET_PLAFOND} jours : vous ne pouvez plus rien y verser.`}
            </p>
          ) : (
            <>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm text-slate-700">
                  {janvier
                    ? <>Au titre de {plan.anneeConges}, vous pouvez verser jusqu&apos;à</>
                    : <>En janvier {plan.anneeVersement}, vous pourrez verser jusqu&apos;à</>}
                </p>
                <p className="text-3xl font-bold text-blue-700 mt-1">
                  {apport.total} jour{apport.total > 1 ? 's' : ''}
                  {apport.total < capacite && (
                    <span className="text-sm font-medium text-slate-500"> sur {capacite} possibles</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {capacite} jours maximum par an, dans la limite de {CET_PLAFOND} jours au total.
                </p>
              </div>

              {lignes.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-2">
                    {janvier ? 'À demander dans GesTT' : 'Le plus avantageux'}
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
              ) : (
                <p className="text-sm text-slate-600">
                  Aucun solde ne peut alimenter le CET pour l&apos;instant (RTC, CA, CA HP ou HS).
                </p>
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
                  récente) : ils ne sont pas comptés ici. Vérifiez-les dans GesTT.
                </p>
              )}

              <p className="text-xs text-slate-500">
                {janvier
                  ? 'Faites la demande dans GesTT avant le 31 janvier, puis enregistrez-la ici pour mettre vos compteurs à jour.'
                  : `Le versement se demande dans GesTT, du 1er au 31 janvier ${plan.anneeVersement}. D’ici là, gardez ces soldes de côté plutôt que de les poser.`}
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
          {janvier && apport.total > 0 && (
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
