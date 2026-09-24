import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { corsHeaders } from '@/lib/server/cors';
import { appendBatch, purgeOld, validatePayload } from '@/lib/server/stats-store';

export const runtime = 'nodejs';

// Collecte des statistiques anonymes (cf. lib/analytics.ts).
// L'IP ne sert qu'au limiteur de débit, en mémoire, sous forme de hash : elle
// n'est jamais écrite avec les statistiques.

const MAX_BODY = 16_384;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 60;

const rateLimitMap = new Map<string, number[]>();
let lastPurgeDay = '';

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0]!.trim() : (req.headers.get('x-real-ip') ?? 'unknown');
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (rateLimitMap.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(key, recent);
  if (rateLimitMap.size > 10_000) {
    for (const [k, list] of rateLimitMap) {
      if (list.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) rateLimitMap.delete(k);
    }
  }
  return true;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'));

  if (!checkRateLimit(clientKey(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers });
  }

  const text = await req.text();
  if (text.length === 0 || text.length > MAX_BODY) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
  }

  const today = new Date().toISOString().slice(0, 10);
  const payload = validatePayload(raw, today);
  if (!payload) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
  }

  try {
    await appendBatch(payload, today);
    if (lastPurgeDay !== today) {
      lastPurgeDay = today;
      void purgeOld(today);
    }
  } catch (err) {
    console.error(`[stats] write failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }

  return NextResponse.json({ ok: true }, { headers });
}
