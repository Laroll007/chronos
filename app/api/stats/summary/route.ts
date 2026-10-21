import { NextRequest, NextResponse } from 'next/server';
import { summarize } from '@/lib/server/stats-store';
import { lireReponses, resumer, sondageClos } from '@/lib/server/sondage-store';
import { lireStores } from '@/lib/server/stores-store';
import { refusAdmin } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

// Tableau de bord /stats : résumé agrégé, protégé par STATS_ADMIN_PASSWORD
// (dans .env.local sur le VPS). Sans cette variable, la route est fermée.

/** Premier jour des statistiques de l'app : avant, seuls les stores ont des chiffres. */
const DEBUT_STATS = '2026-09-24';

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  let body: { password?: unknown; days?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const refus = refusAdmin(req, body.password);
  if (refus) return refus;

  const days = typeof body.days === 'number' && [7, 30, 90, 365].includes(body.days) ? body.days : 30;
  const to = new Date().toISOString().slice(0, 10);
  const from = shiftDay(to, -(days - 1));

  const summary = await summarize(from, to);
  // Sondage « Préparons 2027 » : toutes les réponses, quelle que soit la période.
  const sondage = resumer(await lireReponses(), sondageClos());
  // Stores (exports importés) + nos nouvelles installations depuis le début
  // des statistiques, pour la courbe « depuis la sortie ».
  const stores = await lireStores();
  const depuisDebut = from <= DEBUT_STATS ? summary : await summarize(DEBUT_STATS, to);
  const nosNouveaux = depuisDebut.jours.map((j) => ({ day: j.day, ...j.nouveauxParPlateforme }));
  return NextResponse.json({ ...summary, sondage, stores: { ...stores, nosNouveaux } }, { headers: { 'Cache-Control': 'no-store' } });
}
