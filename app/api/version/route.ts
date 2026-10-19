import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/server/cors';
import { RELEASE_NOTES } from '@/lib/releaseNotes';

// Dernière version de l'app iPhone publiée sur l'App Store, pour prévenir les
// agents restés sur une ancienne version (pas de mise à jour automatique).
// Lue chez Apple (API publique de recherche) : elle n'avance qu'une fois la
// version VALIDÉE, jamais au déploiement du site. Mise en cache une heure.

const APP_ID = '6762043430';
const UNE_HEURE = 3_600_000;
let cache: { version: string; lu: number } | null = null;

async function versionAppStore(): Promise<string | null> {
  if (cache && Date.now() - cache.lu < UNE_HEURE) return cache.version;
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${APP_ID}&country=fr`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    const j = (await r.json()) as { results?: { version?: string }[] };
    const version = j.results?.[0]?.version;
    if (version && /^\d+(\.\d+){0,2}$/.test(version)) {
      cache = { version, lu: Date.now() };
      return version;
    }
  } catch {
    /* Apple injoignable : on garde l'ancienne valeur s'il y en a une */
  }
  return cache?.version ?? null;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'));
  const version = await versionAppStore();
  if (!version) return NextResponse.json({ ios: null }, { headers });
  // Titre de la première nouveauté de cette version (« Quoi de neuf ? »), s'il y en a une.
  const note = RELEASE_NOTES.find((n) => n.version.replace(/\.0$/, '') === version.replace(/\.0$/, ''))?.items.find((i) => !i.enAvant)?.title; // 1re vraie nouveauté (pas le message de soutien)
  return NextResponse.json({ ios: { version, ...(note && { note }) } }, { headers: { ...headers, 'Cache-Control': 'public, max-age=600' } });
}
