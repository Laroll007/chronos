// Accès éditeur au tableau de bord /stats : mot de passe STATS_ADMIN_PASSWORD
// (.env.local sur le VPS), limité à 10 échecs par heure et par IP (hachée, en
// mémoire). Sans la variable, les routes d'administration sont fermées.

import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

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

/** null si le mot de passe est bon ; sinon la réponse d'erreur à renvoyer. */
export function refusAdmin(req: NextRequest, password: unknown): NextResponse | null {
  const expected = process.env.STATS_ADMIN_PASSWORD;
  if (!expected) return NextResponse.json({ error: 'Tableau de bord non configuré' }, { status: 503 });
  const key = clientKey(req);
  if (recentFailures(key).length >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Trop de tentatives, réessayez dans une heure' }, { status: 429 });
  }
  if (typeof password !== 'string' || !passwordMatches(password, expected)) {
    recentFailures(key).push(Date.now());
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }
  return null;
}
