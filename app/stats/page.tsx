'use client';

// Tableau de bord des statistiques anonymes — réservé à l'éditeur.
// Mot de passe : STATS_ADMIN_PASSWORD (.env.local sur le VPS). Gardé en
// sessionStorage le temps de l'onglet, jamais en localStorage.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatsSummary } from '@/lib/server/stats-store';
import { STATS_EVENTS } from '@/lib/stats-events';

const PASSWORD_KEY = 'chronos_stats_admin';
const PERIODS = [7, 30, 90, 365] as const;

// Palette catégorielle validée (validate_palette.js, 4 créneaux, ordre fixe).
// Deux teintes sont sous 3:1 de contraste → la table des jours sert de relais.
const PLATFORMS = [
  { key: 'ios', label: 'iOS', color: '#2a78d6' },
  { key: 'android', label: 'Android', color: '#eb6834' },
  { key: 'pwa', label: 'Web installé', color: '#1baf7a' },
  { key: 'web', label: 'Navigateur', color: '#eda100' },
] as const;

const INK = '#0f172a';
const INK_2 = '#475569';
const MUTED = '#94a3b8';
const GRID = '#e2e8f0';
const BAR = '#2a78d6';

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Barres horizontales HTML : une seule série, une seule couleur. */
function HBars({
  rows,
  emptyLabel = 'Aucune donnée',
}: {
  rows: { key: string; label: string; value: number; note?: string }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] sm:grid-cols-[minmax(0,16rem)_1fr_3.5rem] items-center gap-3 rounded-md px-1 py-0.5 hover:bg-slate-50"
          title={`${r.label} : ${r.value}${r.note ? ` (${r.note})` : ''}`}
        >
          <span className={`truncate text-sm ${r.value === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{r.label}</span>
          <span className="h-3 rounded-r bg-slate-100">
            {r.value > 0 && (
              <span
                className="block h-3 rounded-r"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: BAR }}
              />
            )}
          </span>
          <span className={`text-right text-sm tabular-nums ${r.value === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function StatsPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (pwd: string, period: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stats/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, days: period }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`);
        if (res.status === 401) {
          setAuthed(false);
          sessionStorage.removeItem(PASSWORD_KEY);
        }
        return;
      }
      setData(json as StatsSummary);
      setAuthed(true);
      sessionStorage.setItem(PASSWORD_KEY, pwd);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reprise de session (même onglet)
  useEffect(() => {
    const saved = sessionStorage.getItem(PASSWORD_KEY);
    if (saved) {
      setPassword(saved);
      void load(saved, days);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changePeriod = (p: (typeof PERIODS)[number]) => {
    setDays(p);
    void load(password, p);
  };

  const derived = useMemo(() => {
    if (!data) return null;
    const last = data.jours[data.jours.length - 1];
    const lastWeek = data.semaines[data.semaines.length - 1];
    const lastMonth = data.mois[data.mois.length - 1];
    const totalPlat = PLATFORMS.reduce((s, p) => s + data.plateformes[p.key], 0);
    const onbCycle = data.fonctionnalites.find((f) => f.event === 'onboarding_cycle_done')?.total ?? 0;
    const onbDone = data.fonctionnalites.find((f) => f.event === 'onboarding_done')?.total ?? 0;
    return { last, lastWeek, lastMonth, totalPlat, onbCycle, onbDone };
  }, [data]);

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
        <form
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void load(password, days);
          }}
        >
          <h1 className="text-lg font-bold text-slate-900">Statistiques My Chronos</h1>
          <p className="mt-1 text-sm text-slate-500">Accès réservé.</p>
          <label htmlFor="pwd" className="mt-5 block text-sm font-medium text-slate-700">
            Mot de passe
          </label>
          <input
            id="pwd"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full rounded-lg bg-[#0055A4] py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Chargement…' : 'Ouvrir'}
          </button>
        </form>
      </main>
    );
  }

  if (!data || !derived) return null;

  const { last, lastWeek, lastMonth, totalPlat, onbCycle, onbDone } = derived;
  const featureGroups: string[] = [...new Set(Object.values(STATS_EVENTS).map((e) => e.group))];
  const profileFamilies: Record<string, string> = {
    type: 'Type de cycle',
    pattern: 'Rythme',
    duree: 'Durée du jour',
    option: 'Options',
  };

  return (
    <main className="min-h-screen bg-[#f8f9fc] text-slate-900">
      <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #0055A4 33%, #fff 33%, #fff 66%, #EF4135 66%)' }} />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Statistiques My Chronos</h1>
            <p className="text-sm text-slate-500">
              Anonymes, sans identifiant · du {shortDay(data.from)} au {shortDay(data.to)}
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Période">
            {PERIODS.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={days === p}
                onClick={() => changePeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${days === p ? 'bg-[#0055A4] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {p === 365 ? '1 an' : `${p} j`}
              </button>
            ))}
          </div>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile label="Actifs aujourd'hui" value={last?.actifs ?? 0} hint={`${last?.ouvertures ?? 0} ouvertures`} />
          <Tile label="Actifs cette semaine" value={lastWeek?.actifs ?? 0} hint={lastWeek?.semaine} />
          <Tile label="Actifs ce mois" value={lastMonth?.actifs ?? 0} hint={lastMonth?.mois} />
          <Tile label="Nouvelles installations" value={data.totaux.nouveaux} hint="sur la période" />
          <Tile
            label="Ouvertures / actif / jour"
            value={data.totaux.ouverturesParActif.toLocaleString('fr-FR')}
            hint={`moyenne ${data.totaux.actifsJourMoyen.toLocaleString('fr-FR')} actifs/jour`}
          />
        </div>

        <Card title="Utilisateurs actifs par jour" subtitle="Un appareil compte une fois par jour, par plateforme">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.jours} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: INK_2 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_2 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,0.05)' }}
                  labelFormatter={(d) => shortDay(String(d))}
                  contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 12, color: INK }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: INK_2 }} />
                {PLATFORMS.map((p, i) => (
                  <Bar
                    key={p.key}
                    dataKey={`actifsParPlateforme.${p.key}`}
                    name={p.label}
                    stackId="a"
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth={1}
                    radius={i === PLATFORMS.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Ouvertures de l'app par jour" subtitle="Lancement ou retour après 5 min d'inactivité">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.jours} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: INK_2 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_2 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,23,42,0.05)' }}
                    labelFormatter={(d) => shortDay(String(d))}
                    contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 12, color: INK }}
                  />
                  <Bar dataKey="ouvertures" name="Ouvertures" fill={BAR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Plateformes et versions" subtitle="Part des jours d'activité sur la période">
            <HBars
              rows={PLATFORMS.map((p) => ({
                key: p.key,
                label: `${p.label} (${totalPlat ? Math.round((data.plateformes[p.key] / totalPlat) * 100) : 0} %)`,
                value: data.plateformes[p.key],
              }))}
            />
            <div className="mt-4 border-t border-slate-100 pt-3">
              <HBars
                rows={Object.entries(data.versions)
                  .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
                  .map(([v, n]) => ({ key: v, label: `v${v}`, value: n }))}
              />
            </div>
          </Card>
        </div>

        <Card
          title="Fonctionnalités"
          subtitle={`Nombre d'utilisations sur la période, de la plus à la moins utilisée · entonnoir onboarding : ${onbCycle} cycle renseigné → ${onbDone} terminé`}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            {featureGroups.map((g) => (
              <div key={g}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{g}</h3>
                <HBars
                  rows={data.fonctionnalites
                    .filter((f) => f.group === g)
                    .map((f) => ({
                      key: f.event,
                      label: f.label,
                      value: f.total,
                      note: `${f.joursUtilisateurs} jour(s)-appareil`,
                    }))}
                />
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Profils de cycle" subtitle="Jours d'activité par catégorie">
            <div className="space-y-4">
              {Object.entries(profileFamilies).map(([fam, title]) => {
                const rows = Object.entries(data.profils)
                  .filter(([k]) => k.startsWith(`${fam}:`))
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => ({ key: k, label: k.slice(fam.length + 1), value: n }));
                if (rows.length === 0) return null;
                return (
                  <div key={fam}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
                    <HBars rows={rows} />
                  </div>
                );
              })}
              {Object.keys(data.profils).length === 0 && <p className="text-sm text-slate-500">Aucune donnée</p>}
            </div>
          </Card>

          <Card title="Erreurs" subtitle="Type et message nettoyé (chiffres et textes masqués)">
            {data.erreurs.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune erreur remontée 🎉</p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs text-slate-500">
                    <tr>
                      <th className="py-1.5 pr-2 font-medium">Erreur</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Nb</th>
                      <th className="py-1.5 text-right font-medium">Dernière</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.erreurs.map((e) => (
                      <tr key={e.key} className="border-t border-slate-100 align-top">
                        <td className="py-1.5 pr-2 font-mono text-xs break-all text-slate-700">{e.key}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{e.total}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-500">{shortDay(e.dernierJour)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Données par jour" subtitle="Table complète (relais des graphiques)">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-[#0055A4]">Afficher la table</summary>
            <div className="mt-3 max-h-96 overflow-auto">
              <table className="w-full text-right text-sm tabular-nums">
                <thead className="sticky top-0 bg-white text-xs text-slate-500">
                  <tr>
                    <th className="py-1.5 text-left font-medium">Jour</th>
                    <th className="py-1.5 font-medium">Actifs</th>
                    {PLATFORMS.map((p) => (
                      <th key={p.key} className="py-1.5 font-medium">{p.label}</th>
                    ))}
                    <th className="py-1.5 font-medium">Nouveaux</th>
                    <th className="py-1.5 font-medium">Ouvertures</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.jours].reverse().map((j) => (
                    <tr key={j.day} className="border-t border-slate-100">
                      <td className="py-1 text-left">{shortDay(j.day)}</td>
                      <td className="py-1 font-semibold">{j.actifs}</td>
                      {PLATFORMS.map((p) => (
                        <td key={p.key} className="py-1" style={{ color: j.actifsParPlateforme[p.key] ? INK : MUTED }}>
                          {j.actifsParPlateforme[p.key]}
                        </td>
                      ))}
                      <td className="py-1">{j.nouveaux}</td>
                      <td className="py-1">{j.ouvertures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      </div>
    </main>
  );
}
