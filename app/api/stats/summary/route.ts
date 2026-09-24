import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { summarize } from '@/lib/server/stats-store';

export const runtime = 'nodejs';

// Tableau de bord /stats : résumé agrégé, protégé par STATS_ADMIN_PASSWORD
// (dans .env.local sur le VPS). Sans cette variable, la route est fermée.

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 60 * 60 * 1000;
const failures = new Map<string, number[]>();

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0]!.trim() : (req.headers.get('x-real-ip') ?? 'unknown');
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function recentFailures(key: string): number[] {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS);
  failures.set(key, list);
  return list;
}

function passwordMatches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const expected = process.env.STATS_ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'Tableau de bord non configuré' }, { status: 503 });
  }

  const key = clientKey(req);
  if (recentFailures(key).length >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Trop de tentatives, réessayez dans une heure' }, { status: 429 });
  }

  let body: { password?: unknown; days?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  if (typeof body.password !== 'string' || !passwordMatches(body.password, expected)) {
    recentFailures(key).push(Date.now());
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }

  const days = typeof body.days === 'number' && [7, 30, 90, 365].includes(body.days) ? body.days : 30;
  const to = new Date().toISOString().slice(0, 10);
  const from = shiftDay(to, -(days - 1));

  const summary = await summarize(from, to);
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
