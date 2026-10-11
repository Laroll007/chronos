'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, PiggyBank, X } from 'lucide-react';
import type { ChoixCET, Counters, UserData } from '@/lib/types';
import {
  planEpargneCET,
  remplirMaximum,
  remplirSansPaiement,
  SOURCES_CET,
  type ApportCET,
  type SourceCET,
} from '@/lib/cet';
import { formatMinutes } from '@/lib/calculations';
import { track } from '@/lib/analytics';
import {
  CA_HP_BONUS,
  CA_MAX_VERS_CET,
  CET_PLAFOND,
  CET_PLAFOND_DEROGATOIRE,
  CET_PROGRESSION_ANNUELLE_MAX,
  CET_SEUIL_OPTION,
  HS_MAX_VERS_CET,
} from '@/lib/constants';

interface CETPlanModalProps {
  userData: UserData;
  onClose: () => void;
  /** Janvier : enregistre le versement retenu (choisi, sinon conseillé). */
  onRecord: () => { success: boolean; error?: string };
  /** Enregistre le versement choisi ligne par ligne. */
  onUpdateCounters?: (updates: Partial<Counters>) => unknown;
}

const LIBELLES: Record<SourceCET, string> = {
  rtc: 'RTC',
  artt: 'ARTT',
  rtt: 'RTT',
  caHP: 'CA HP',
  ca: 'CA',
  hs: 'HS',
};

/** « 4,5 j » : virgule française, demi-journées comprises. */
const j = (n: number) => `${n.toLocaleString('fr-FR')} j`;
const jours = (n: number) => `${n.toLocaleString('fr-FR')} jour${n > 1 ? 's' : ''}`;

const valeurs = (a: ApportCET) => ({ rtc: a.rtc, artt: a.artt, rtt: a.rtt, caHP: a.caHP, ca: a.ca, hs: a.hs });

/**
 * « Mon épargne CET » : pour chaque compteur épargnable, ce que l'agent a, le
 * maximum autorisé et ce qu'il choisit d'épargner (demi-journées admises).
 * Deux boutons remplissent le tableau : le max sans se faire payer (ce que le
 * CET garde), ou le max en se faisant payer le surplus (ou RAFP).
 */
export function CETPlanModal({ userData, onClose, onRecord, onUpdateCounters }: CETPlanModalProps) {
  const plan = useMemo(() => planEpargneCET(userData), [userData]);
  const [error, setError] = useState<string | null>(null);
  const { apport, capacite, maximum, soldes, conditionCA } = plan;
  const c = userData.counters;
  const cet = c.cet;
  const gele = cet > CET_PLAFOND;
  const janvier = plan.mode === 'janvier';

  const sansPaiement = useMemo(() => remplirSansPaiement(maximum, capacite), [maximum, capacite]);
  const avecPaiement = useMemo(() => remplirMaximum(maximum), [maximum]);
  const memeVersement = (a: ApportCET, b: ApportCET) => SOURCES_CET.every((k) => a[k] === b[k]);

  // Lignes affichées : les compteurs que l'agent possède (et les CA, toujours).
  const lignes = SOURCES_CET.filter((k) => {
    if (k === 'rtc') return c.hasRTC !== false || maximum.rtc > 0;
    if (k === 'artt') return c.hasARTT || maximum.artt > 0;
    if (k === 'rtt') return c.hasRTT || maximum.rtt > 0;
    if (k === 'caHP') return maximum.caHP > 0 || soldes.caHP > 0;
    if (k === 'hs') return maximum.hs > 0 || soldes.hs > 0;
    return true;
  });

  const choisir = (v: Omit<ChoixCET, 'annee'>) => {
    if (!onUpdateCounters) return;
    setError(null);
    // Hors janvier, les RTC, HS et CA choisis sont aussi protégés à la pose.
    onUpdateCounters({
      choixCET: { annee: plan.anneeConges, ...v },
      ...(!janvier && { rtcJoursCET: v.rtc, hsJoursCET: v.hs, caReservesCET: v.ca }),
    });
  };
  const revenirAuConseil = () => {
    onUpdateCounters?.({
      choixCET: undefined,
      ...(!janvier && { rtcJoursCET: undefined, hsJoursCET: undefined, caReservesCET: 0 }),
    });
  };

  const total = apport.total;
  const demiJourneeIsolee = !Number.isInteger(total);
  const garde = Math.min(total, capacite);
  const surplus = Math.max(0, total - capacite);

  const record = () => {
    const res = onRecord();
    if (res.success) onClose();
    else setError(res.error ?? 'Enregistrement impossible');
  };

  // Règles qui s'appliquent à l'agent, selon son CET actuel.
  const regles: string[] = [];
  if (cet < CET_SEUIL_OPTION) {
    regles.push(
      cet === 0
        ? `Jusqu’à ${CET_SEUIL_OPTION} jours : gardés sans condition.`
        : `${jours(CET_SEUIL_OPTION - cet)} pour atteindre ${CET_SEUIL_OPTION}, gardés sans condition.`
    );
  }
  if (capacite > 0) {
    regles.push(
      `${cet < CET_SEUIL_OPTION ? 'Puis' : 'Au-delà de ' + CET_SEUIL_OPTION + ' jours,'} ${CET_PROGRESSION_ANNUELLE_MAX} jours de plus cette année : votre CET peut monter à ${cet + capacite} jours (${CET_PLAFOND} au total).`
    );
  }
  regles.push('Le reste est payé ou versé à la RAFP (choix dans GesTT). Il ne revient pas en congés.');
  if (cet + capacite <= CET_SEUIL_OPTION) regles.push(`Sous ${CET_SEUIL_OPTION} jours, le CET ne sert qu’en congés.`);

  const pct = (n: number) => `${Math.min(100, (n / CET_PLAFOND) * 100)}%`;

  const soldeAffiche = (k: SourceCET) =>
    k === 'rtc' || k === 'hs' ? formatMinutes(soldes[k]) : j(soldes[k]);

  const precision = (k: SourceCET): { texte: string; alerte?: boolean } | null => {
    if (k === 'rtc') return { texte: '8h21 le jour' };
    if (k === 'hs') return { texte: `8h21 le jour · ${HS_MAX_VERS_CET} j maximum` };
    if (k === 'artt' || k === 'rtt') return { texte: 'Tous versables' };
    if (k === 'caHP') return { texte: `${CA_HP_BONUS} j maximum` };
    // CA : condition des congés pris dans l'année.
    if (conditionCA.ok) return { texte: `${CA_MAX_VERS_CET} j maximum · ${conditionCA.poses} CA posés ✓` };
    return janvier
      ? { texte: `Il fallait en avoir posé ${conditionCA.seuil} en ${plan.anneeConges} (${conditionCA.poses} posés)`, alerte: true }
      : { texte: `Seulement si vous en posez ${conditionCA.seuil} d’ici au 31/12 (${conditionCA.poses} posés)`, alerte: true };
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
                Versement de janvier {plan.anneeVersement}, au titre de {plan.anneeConges}
              </p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-[#f8f9fc]">
          {/* Le CET et ses règles */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-700">Votre CET</span>
              <span className="text-2xl font-bold text-slate-900">{j(cet)}</span>
            </div>
            {gele ? (
              <p className="text-sm text-slate-700 mt-2">
                Votre CET dépasse le plafond de {CET_PLAFOND} jours grâce aux relèvements exceptionnels
                (COVID, JOP 2024, jusqu’à {CET_PLAFOND_DEROGATOIRE} jours) : vos jours sont conservés, mais
                il est gelé et ne peut pas être alimenté cette année.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600 mt-1">
                  {capacite > 0
                    ? <>Il peut encore garder <strong>{jours(capacite)}</strong> cette année.</>
                    : <>Il est au plafond de {CET_PLAFOND} jours : tout versement serait payé ou versé à la RAFP.</>}
                </p>
                <div className="mt-3 h-3 rounded-full bg-slate-200 overflow-hidden flex" aria-hidden="true">
                  <span className="h-full bg-[#0055A4]" style={{ width: pct(cet) }} />
                  <span className="h-full bg-blue-400" style={{ width: pct(garde) }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1" aria-hidden="true">
                  <span>0</span><span>15</span><span>30</span><span>45</span><span>60 j</span>
                </div>
                <ul className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-1 text-xs text-slate-700">
                  {regles.map((r) => <li key={r}>• {r}</li>)}
                </ul>
              </>
            )}
          </div>

          {!gele && maximum.total === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Aucun solde ne peut alimenter le CET pour l&apos;instant (RTC, ARTT, RTT, CA, CA HP ou HS).
            </p>
          )}

          {!gele && maximum.total > 0 && (
            <>
              {/* Remplissage automatique */}
              {onUpdateCounters && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remplir automatiquement</p>
                  {[
                    {
                      cle: 'sans',
                      v: sansPaiement,
                      titre: 'Épargner le max sans me faire payer',
                      detail: `${j(sansPaiement.total)} : le maximum que votre CET accepte cette année, rien n’est payé`,
                      evt: 'cet_remplir_sans_paiement' as const,
                    },
                    {
                      cle: 'avec',
                      v: avecPaiement,
                      titre: 'Épargner le max en me faisant payer',
                      detail:
                        avecPaiement.total > capacite
                          ? `${j(avecPaiement.total)} : ${capacite} sur votre CET, ${(avecPaiement.total - capacite).toLocaleString('fr-FR')} payés ou versés à la RAFP`
                          : `${j(avecPaiement.total)} : tout tient dans votre CET, rien n’est payé`,
                      evt: 'cet_remplir_avec_paiement' as const,
                    },
                  ].map((b) => {
                    const actif = memeVersement(apport, b.v);
                    return (
                      <button
                        key={b.cle}
                        type="button"
                        aria-pressed={actif}
                        onClick={() => { track(b.evt); choisir(valeurs(b.v)); }}
                        className={`w-full rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                          actif ? 'border-[#0055A4] bg-[#0055A4] text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{b.titre}</span>
                        <span className={`block text-xs mt-0.5 ${actif ? 'text-blue-100' : 'text-slate-500'}`}>{b.detail}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Ligne par ligne */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-500">
                      <th className="text-left font-semibold pb-1.5">Compteur</th>
                      <th className="text-right font-semibold pb-1.5 px-1">Vous avez</th>
                      <th className="text-right font-semibold pb-1.5 px-1">Max</th>
                      <th className="text-right font-semibold pb-1.5">J&apos;épargne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((k) => {
                      const p = precision(k);
                      const inactif = maximum[k] === 0;
                      return (
                        <tr key={k} className="border-t border-slate-100">
                          <td className="py-2 pr-1 align-middle">
                            <span className={`font-semibold ${inactif ? 'text-slate-400' : 'text-slate-900'}`}>{LIBELLES[k]}</span>
                            {p && (
                              <span className={`block text-[11px] leading-snug ${p.alerte ? 'text-amber-700' : 'text-slate-500'}`}>{p.texte}</span>
                            )}
                          </td>
                          <td className="py-2 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">{soldeAffiche(k)}</td>
                          <td className="py-2 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">{j(maximum[k])}</td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              inputMode="decimal"
                              step={0.5}
                              min={0}
                              max={maximum[k]}
                              disabled={inactif || !onUpdateCounters}
                              aria-label={`Jours de ${LIBELLES[k]} à épargner`}
                              value={apport[k]}
                              onChange={(e) => {
                                const brut = parseFloat(e.target.value.replace(',', '.'));
                                const v = Math.min(maximum[k], Math.max(0, Math.floor((Number.isFinite(brut) ? brut : 0) * 2) / 2));
                                track('cet_choix_manuel');
                                choisir({ ...valeurs(apport), [k]: v });
                              }}
                              className={`w-16 h-9 rounded-lg border text-center text-base font-bold disabled:opacity-40 ${
                                apport[k] > 0 ? 'border-[#0055A4] bg-blue-50 text-[#0055A4]' : 'border-slate-300 bg-white text-slate-900'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-2 pt-2 border-t-2 border-slate-200">
                  <div className="flex justify-between text-base font-bold text-slate-900">
                    <span>Total épargné</span>
                    <span>{j(total)}</span>
                  </div>
                  {demiJourneeIsolee ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      Il reste une demi-journée isolée : le CET se verse en jours entiers. Complétez-la avec
                      ½ jour d&apos;un autre compteur, ou retirez-la.
                    </p>
                  ) : total === 0 ? null : surplus === 0 ? (
                    <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">
                      ✓ Tout reste sur votre CET
                    </p>
                  ) : (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                      → {j(garde)} restent sur votre CET
                      <br />→ <strong>{j(surplus)} au-delà : payés ou versés à la RAFP</strong> (choix dans GesTT)
                    </p>
                  )}
                  {total > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      Votre CET après versement : <strong>{j(cet + garde)}</strong>
                    </p>
                  )}
                  {plan.choisi && onUpdateCounters && !memeVersement(apport, plan.conseille) && (
                    <button type="button" onClick={revenirAuConseil} className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800">
                      Revenir au versement conseillé ({j(plan.conseille.total)})
                    </button>
                  )}
                </div>
              </div>

              {plan.reliquatRTCInconnu && (
                <p className="text-xs text-slate-500">
                  Vos RTC restants au 31 décembre ne sont pas connus de l&apos;app (inscription
                  récente) : ils ne sont pas comptés ici. Vérifiez-les sur votre relevé de compteurs.
                </p>
              )}

              <p className="text-xs text-slate-500">
                {janvier
                  ? 'Faites la demande avant le 31 janvier (GesTT ou service de gestion), puis enregistrez-la ici pour mettre vos compteurs à jour.'
                  : `Le versement se demande (GesTT ou service de gestion) du 1er au 31 janvier ${plan.anneeVersement}. D’ici là, les RTC, HS et CA choisis ne vous sont plus proposés quand vous posez des congés.`}
              </p>
            </>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex gap-2 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Fermer
          </button>
          {janvier && !gele && total > 0 && (
            <button
              type="button"
              onClick={record}
              disabled={demiJourneeIsolee}
              className="flex-[2] h-11 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 100%)' }}
            >
              <CheckCircle2 className="w-4 h-4" />
              J&apos;ai fait ma demande dans GesTT
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
