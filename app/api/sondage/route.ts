import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { corsHeaders } from '@/lib/server/cors';
import {
  PROFIL_RE,
  besoinPourProfil,
  enregistrerReponse,
  lireReponses,
  sondageClos,
  validerReponse,
} from '@/lib/server/sondage-store';

export const runtime = 'nodejs';

// Sondage « Préparons 2027 » (cf. lib/sondage2027.ts).
// GET ?profil=… : ce profil a-t-il encore besoin de réponses ?
// POST : enregistre une réponse anonyme. L'IP ne sert qu'au limiteur de débit,
// en mémoire et hachée ; elle n'est jamais écrite.

const MAX_BODY = 2048;
const FENETRE_MS = 60 * 60 * 1000;
const MAX_PAR_FENETRE = 10;
const envois = new Map<string, number[]>();

function cleClient(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0]!.trim() : (req.headers.get('x-real-ip') ?? 'unknown');
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function autorise(cle: string): boolean {
  const now = Date.now();
  const recents = (envois.get(cle) ?? []).filter((t) => now - t < FENETRE_MS);
  if (recents.length >= MAX_PAR_FENETRE) {
    envois.set(cle, recents);
    return false;
  }
  recents.push(now);
  envois.set(cle, recents);
  if (envois.size > 10_000) envois.clear();
  return true;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function GET(req: NextRequest) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Cache-Control': 'no-store' };
  const profil = req.nextUrl.searchParams.get('profil') ?? '';
  if (!PROFIL_RE.test(profil)) return NextResponse.json({ besoin: false }, { headers });
  if (sondageClos()) return NextResponse.json({ besoin: false }, { headers });
  const reponses = await lireReponses();
  return NextResponse.json({ besoin: besoinPourProfil(reponses, profil) }, { headers });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'));
  if (sondageClos()) return NextResponse.json({ error: 'clos' }, { status: 410, headers });
  if (!autorise(cleClient(req))) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers });

  const texte = await req.text();
  if (texte.length === 0 || texte.length > MAX_BODY) return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
  let raw: unknown;
  try {
    raw = JSON.parse(texte);
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
  }
  const reponse = validerReponse(raw, new Date().toISOString().slice(0, 10));
  if (!reponse) return NextResponse.json({ error: 'invalid' }, { status: 400, headers });

  try {
    await enregistrerReponse(reponse);
  } catch (err) {
    console.error(`[sondage] écriture impossible : ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
