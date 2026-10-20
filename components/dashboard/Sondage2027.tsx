'use client';

// Sondage « Préparons 2027 » (cf. lib/sondage2027.ts) : l'agent confirme ou
// corrige les dotations que l'app lui créditera au 1er janvier, et règle le
// cas du compteur ARTT en double s'il est en cycle.

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { CompteurSondage, Counters, CycleConfig, MotifEcartSondage, ReponseSondage } from '@/lib/types';
import {
  COMPTEURS_EN_JOURS,
  aujourdhuiCle,
  dotationsPrevues,
  libelleProfil,
  profilSondage,
  questionArtt,
} from '@/lib/sondage2027';
import { ARTT_QUOTA_ANNUEL, APP_VERSION } from '@/lib/constants';
import { formatMinutes } from '@/lib/calculations';
import { apiUrl } from '@/lib/api';
import { detectPlatform, isStatsEnabled, track } from '@/lib/analytics';

type Etape = 'prevu' | 'corrige' | 'artt' | 'merci';

const LIBELLES: Record<CompteurSondage, { titre: string; sous?: string }> = {
  ca: { titre: 'Congés annuels (CA)' },
  rtc: { titre: 'RTC', sous: 'appelés « ARTT » dans la grille' },
  cf: { titre: 'Crédits fériés (CF)' },
  artt: { titre: 'ARTT' },
  rtt: { titre: 'RTT' },
};
const MOTIFS: { cle: MotifEcartSondage; label: string }[] = [
  { cle: 'arrivee', label: 'Arrivée en cours d’année' },
  { cle: 'temps_partiel', label: 'Temps partiel' },
  { cle: 'maladie', label: 'Arrêt maladie' },
  { cle: 'autre', label: 'Autre' },
];

const valeurLisible = (k: CompteurSondage, v: number) =>
  COMPTEURS_EN_JOURS.has(k) ? `${String(v).replace('.', ',')} j` : formatMinutes(v);

/** Envoi anonyme de la réponse (profil + dotations), seulement si les statistiques sont actives. */
function envoyer(cfg: CycleConfig, r: ReponseSondage): void {
  if (!isStatsEnabled()) return;
  const corps = {
    profil: profilSondage(cfg),
    plateforme: detectPlatform() === 'pwa' ? 'web' : detectPlatform(),
    version: APP_VERSION,
    reponse: r.reponse,
    ...(r.reponse === 'corrige' && r.dotations && { dotations: r.dotations }),
    ...(r.motif && { motif: r.motif }),
    ...(r.artt && { artt: r.artt }),
    ...(r.arttJours !== undefined && { arttJours: r.arttJours }),
  };
  fetch(apiUrl('/api/sondage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
    keepalive: true,
  })
    .then((res) => {
      if (res.ok) track('sondage_repondu');
    })
    .catch(() => {
      /* hors ligne : la réponse reste appliquée sur l'appareil */
    });
}

export function Sondage2027({
  cycleConfig,
  counters,
  onRepondre,
  onPlusTard,
  onClose,
}: {
  cycleConfig: CycleConfig;
  counters: Counters;
  onRepondre: (r: ReponseSondage) => void;
  onPlusTard: () => void;
  onClose: () => void;
}) {
  const prevues = useMemo(() => dotationsPrevues(cycleConfig, counters), [cycleConfig, counters]);
  const avecArtt = questionArtt(cycleConfig, counters);
  const nbQuestions = avecArtt ? 2 : 1;

  const [etape, setEtape] = useState<Etape>('prevu');
  const [reponse, setReponse] = useState<ReponseSondage['reponse']>('confirme');
  const [valeurs, setValeurs] = useState<Partial<Record<CompteurSondage, number>>>(
    () => Object.fromEntries(prevues.map((d) => [d.compteur, d.valeur]))
  );
  const [appliquer, setAppliquer] = useState(true);
  const [motif, setMotif] = useState<MotifEcartSondage | undefined>();
  const [artt, setArtt] = useState<'meme' | 'distinct' | 'nsp'>('meme');
  const [arttJours, setArttJours] = useState(ARTT_QUOTA_ANNUEL);
  const [finale, setFinale] = useState<ReponseSondage | null>(null);

  useEffect(() => {
    track('sondage_vu');
  }, []);

  /** Valeurs différentes de la grille : seules celles-là sont « corrigées ». */
  const corrections = useMemo(() => {
    const d: Partial<Record<CompteurSondage, number>> = {};
    for (const p of prevues) {
      const v = valeurs[p.compteur];
      if (v !== undefined && v !== p.valeur) d[p.compteur] = v;
    }
    return d;
  }, [prevues, valeurs]);

  const terminer = (rep: ReponseSondage['reponse'], arttChoix?: typeof artt) => {
    const r: ReponseSondage = {
      reponse: rep,
      date: aujourdhuiCle(),
      ...(rep === 'corrige' && { dotations: corrections, appliquer }),
      ...(rep === 'corrige' && motif && { motif }),
      ...(arttChoix && { artt: arttChoix }),
      ...(arttChoix === 'distinct' && { arttJours }),
    };
    onRepondre(r);
    envoyer(cycleConfig, r);
    setFinale(r);
    setEtape('merci');
  };

  const suite = (rep: ReponseSondage['reponse']) => {
    setReponse(rep);
    if (avecArtt) setEtape('artt');
    else terminer(rep);
  };

  const fermer = () => {
    if (etape === 'merci') onClose();
    else {
      track('sondage_plus_tard');
      onPlusTard();
      onClose();
    }
  };

  const entete = {
    prevu: { ico: '🎆', titre: 'Préparons 2027 ensemble', sous: '1 minute · anonyme' },
    corrige: { ico: '✎', titre: 'Vos chiffres GesTT', sous: 'Crédit du 1er janvier 2026' },
    artt: { ico: '❓', titre: 'Votre compteur ARTT', sous: `Question ${nbQuestions} sur ${nbQuestions}` },
    merci: { ico: '💙', titre: 'Merci pour votre aide', sous: 'Votre réponse est enregistrée' },
  }[etape];

  const progression = etape === 'artt' ? 100 : etape === 'merci' ? 100 : 100 / (nbQuestions + 1);

  // Ce qui sera crédité au 1er janvier 2027, pour le récapitulatif.
  const recap = prevues.map((p) => ({
    compteur: p.compteur,
    valeur: finale?.reponse === 'corrige' && finale.appliquer ? (finale.dotations?.[p.compteur] ?? p.valeur) : p.valeur,
  }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) fermer(); }}>
      <DialogContent className="w-[94vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl flex flex-col max-h-[90vh]" showCloseButton={false}>
        <div className="px-5 pt-5 pb-4 text-white shrink-0" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0" aria-hidden="true">{entete.ico}</div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold leading-tight text-white">{entete.titre}</DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">{entete.sous}</p>
            </div>
          </div>
          <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 bg-white text-sm text-slate-700 leading-relaxed">
          {etape === 'prevu' && (
            <div className="space-y-3">
              <p>
                Je prépare le passage à la nouvelle année. Au 1er janvier, l’app recréditera vos congés :{' '}
                <strong className="text-slate-900">aidez-moi à vérifier que c’est juste pour votre cycle.</strong>
              </p>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {libelleProfil(cycleConfig)}
              </span>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {prevues.map((d) => (
                  <div key={d.compteur} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <div className="font-semibold text-slate-900">{LIBELLES[d.compteur].titre}</div>
                      {LIBELLES[d.compteur].sous && <div className="text-xs text-slate-500">{LIBELLES[d.compteur].sous}</div>}
                    </div>
                    <div className="text-lg font-bold text-[#0055A4] tabular-nums">{valeurLisible(d.compteur, d.valeur)}</div>
                  </div>
                ))}
              </div>
              <p className="font-semibold text-slate-900">Au 1er janvier 2026, GesTT vous a-t-il crédité ces chiffres ?</p>
            </div>
          )}

          {etape === 'corrige' && (
            <div className="space-y-3">
              <p>
                Recopiez ce que GesTT vous a crédité <strong className="text-slate-900">au 1er janvier</strong> (pas votre solde d’aujourd’hui).
              </p>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {prevues.map((d) => {
                  const v = valeurs[d.compteur] ?? 0;
                  const modifie = v !== d.valeur;
                  const champ = `w-16 h-9 rounded-lg border-2 text-center font-bold text-slate-900 ${modifie ? 'border-amber-400 bg-amber-50' : 'border-blue-200 bg-white'}`;
                  const maj = (n: number) => setValeurs((p) => ({ ...p, [d.compteur]: Math.max(0, n) }));
                  return (
                    <div key={d.compteur} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="font-semibold text-slate-900">{LIBELLES[d.compteur].titre.replace(/ \(.*\)/, '')}</span>
                      {COMPTEURS_EN_JOURS.has(d.compteur) ? (
                        <span className="flex items-center gap-1.5">
                          <input type="number" inputMode="decimal" min={0} max={60} step={0.5} aria-label={`${LIBELLES[d.compteur].titre} en jours`}
                            value={v} onChange={(e) => maj(Number(e.target.value) || 0)} className={champ} />
                          <span className="text-slate-500">j</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <input type="number" inputMode="numeric" min={0} max={600} aria-label={`${LIBELLES[d.compteur].titre} : heures`}
                            value={Math.floor(v / 60)} onChange={(e) => maj((parseInt(e.target.value) || 0) * 60 + (v % 60))} className={champ} />
                          <span className="text-slate-500">h</span>
                          <input type="number" inputMode="numeric" min={0} max={59} aria-label={`${LIBELLES[d.compteur].titre} : minutes`}
                            value={v % 60} onChange={(e) => maj(Math.floor(v / 60) * 60 + Math.min(59, parseInt(e.target.value) || 0))} className={`${champ} w-14`} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <label className={`flex items-start gap-2.5 rounded-xl border-2 p-3 cursor-pointer ${appliquer ? 'border-[#0055A4] bg-blue-50' : 'border-slate-200'}`}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0055A4]" checked={appliquer} onChange={(e) => setAppliquer(e.target.checked)} />
                <span>
                  <strong className="block text-slate-900">Utiliser ces chiffres pour moi au 1er janvier 2027</strong>
                  L’app vous créditera ces valeurs au lieu de la grille.
                </span>
              </label>
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Une raison à l’écart ? (facultatif)</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOTIFS.map((m) => (
                    <button key={m.cle} type="button" onClick={() => setMotif(motif === m.cle ? undefined : m.cle)} aria-pressed={motif === m.cle}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${motif === m.cle ? 'border-[#0055A4] bg-[#0055A4] text-white' : 'border-slate-300 text-slate-600'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {etape === 'artt' && (
            <div className="space-y-2.5" role="radiogroup" aria-label="Votre compteur ARTT">
              <p>
                Vous avez <strong className="text-slate-900">des RTC et un compteur ARTT</strong>. En cycle, la grille appelle souvent les RTC
                « ARTT » : ce sont alors les mêmes heures.
              </p>
              <p className="font-semibold text-slate-900">Dans GesTT, c’est…</p>
              {([
                ['meme', 'Le même compteur', 'Je n’ai qu’un compteur d’heures. L’app retire le compteur ARTT en double.'],
                ['distinct', 'Deux compteurs différents', 'J’ai bien des RTC et des ARTT.'],
                ['nsp', 'Je ne sais pas', 'L’app ne recrédite pas d’ARTT au 1er janvier ; vous pourrez corriger vous-même.'],
              ] as const).map(([cle, titre, texte]) => (
                <label key={cle} className={`flex items-start gap-2.5 rounded-xl border-2 p-3 cursor-pointer ${artt === cle ? 'border-[#0055A4] bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name="artt" className="mt-1 accent-[#0055A4]" checked={artt === cle} onChange={() => setArtt(cle)} />
                  <span>
                    <strong className="block text-slate-900">{titre}</strong>
                    {texte}
                    {cle === 'distinct' && artt === 'distinct' && (
                      <span className="mt-2 flex items-center gap-1.5">
                        <input type="number" inputMode="decimal" min={0} max={60} step={0.5} aria-label="Jours d’ARTT au 1er janvier"
                          value={arttJours} onChange={(e) => setArttJours(Math.max(0, Number(e.target.value) || 0))}
                          className="w-16 h-8 rounded-lg border-2 border-blue-200 text-center font-bold text-slate-900" />
                        <span className="text-slate-600">jours d’ARTT au 1er janvier</span>
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          {etape === 'merci' && finale && (
            <div className="space-y-3 text-center">
              <div className="text-5xl pt-1" aria-hidden="true">🙏</div>
              <p className="text-base font-bold text-slate-900">Votre 1er janvier est prêt</p>
              <p>Grâce aux réponses de tous, chaque cycle aura les bons chiffres.</p>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-left">
                {recap.map((d) => (
                  <div key={d.compteur} className="flex items-center justify-between px-3 py-2">
                    <span className="font-semibold text-slate-900">{LIBELLES[d.compteur].titre.replace(/ \(.*\)/, '')}</span>
                    <span className="font-bold text-[#0055A4] tabular-nums">{valeurLisible(d.compteur, d.valeur)}</span>
                  </div>
                ))}
                {finale.artt && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="font-semibold text-slate-900">ARTT</span>
                    <span className="font-bold text-slate-500">
                      {finale.artt === 'meme' ? 'retiré (doublon)' : finale.artt === 'distinct' ? `${finale.arttJours} j` : 'non recrédité'}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 text-left rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                🔒 Réponse anonyme : seuls le type de cycle et ces chiffres sont envoyés (si « Aider à améliorer l’app » est activé),
                jamais votre planning ni qui vous êtes.
              </p>
            </div>
          )}

          {etape !== 'merci' && (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${progression}%`, background: 'linear-gradient(90deg,#0055A4,#1a7de8)' }} />
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 pb-5 pt-3 bg-white border-t border-slate-100 space-y-2">
          {etape === 'prevu' && (
            <>
              <button type="button" onClick={() => suite('confirme')} className="w-full h-12 rounded-xl text-white font-semibold shadow-md" style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
                ✓ Oui, c’est bien ça
              </button>
              <button type="button" onClick={() => setEtape('corrige')} className="w-full h-11 rounded-xl border-2 border-blue-200 text-[#0055A4] font-semibold">
                ✎ Non, je corrige
              </button>
              <div className="flex justify-center gap-4 text-xs font-semibold text-slate-500">
                <button type="button" onClick={() => suite('nsp')}>Je ne sais pas</button>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={fermer}>Plus tard</button>
              </div>
            </>
          )}
          {etape === 'corrige' && (
            <>
              <button type="button" onClick={() => suite(Object.keys(corrections).length > 0 ? 'corrige' : 'confirme')}
                className="w-full h-12 rounded-xl text-white font-semibold shadow-md" style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
                Valider
              </button>
              <button type="button" onClick={() => setEtape('prevu')} className="w-full text-xs font-semibold text-slate-500">← Retour</button>
            </>
          )}
          {etape === 'artt' && (
            <button type="button" onClick={() => terminer(reponse, artt)}
              className="w-full h-12 rounded-xl text-white font-semibold shadow-md" style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
              Valider
            </button>
          )}
          {etape === 'merci' && (
            <button type="button" onClick={onClose} className="w-full h-12 rounded-xl text-white font-semibold shadow-md" style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
              Terminer
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
