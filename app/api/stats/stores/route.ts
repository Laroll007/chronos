import { NextRequest, NextResponse } from 'next/server';
import { refusAdmin } from '@/lib/server/admin-auth';
import { ecrireStores, fusionnerExport, lireExportStore, lireStores } from '@/lib/server/stores-store';

export const runtime = 'nodejs';

// Import d'un export CSV des stores (Play Console, App Store Connect) depuis
// le tableau de bord /stats. Réservé à l'éditeur (STATS_ADMIN_PASSWORD).

const MAX_CSV = 1_000_000;

export async function POST(req: NextRequest) {
  let body: { password?: unknown; csv?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const refus = refusAdmin(req, body.password);
  if (refus) return refus;

  if (typeof body.csv !== 'string' || body.csv.length === 0 || body.csv.length > MAX_CSV) {
    return NextResponse.json({ error: 'Fichier vide ou trop gros' }, { status: 400 });
  }
  const export_ = lireExportStore(body.csv);
  if (!export_) {
    return NextResponse.json({ error: 'Format non reconnu (export Play Console ou App Store Connect attendu)' }, { status: 400 });
  }
  const aujourdhui = new Date().toISOString().slice(0, 10);
  await ecrireStores(fusionnerExport(await lireStores(), export_, aujourdhui));
  const jours = Object.keys(export_.jours).sort();
  return NextResponse.json({ ok: true, plateforme: export_.plateforme, jours: jours.length, du: jours[0], au: jours[jours.length - 1] });
}
