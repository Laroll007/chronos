import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  amelioration: 'Amélioration',
  question: 'Question',
};

const VALID_TYPES = new Set(Object.keys(TYPE_LABELS));
const MAX_MESSAGE = 2000;
const MAX_EMAIL = 254;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ipHash) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ipHash, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ipHash, timestamps);
  if (rateLimitMap.size > 10_000) {
    for (const key of rateLimitMap.keys()) {
      const list = rateLimitMap.get(key);
      if (!list || list.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }
  return true;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  const ipHash = hashIp(getClientIp(req));

  if (!checkRateLimit(ipHash)) {
    return NextResponse.json(
      { error: 'Trop de demandes, réessayez plus tard' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
  }

  const { type, message, email, consent, website } = body as Record<string, unknown>;

  if (typeof website === 'string' && website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (consent !== true) {
    return NextResponse.json(
      { error: 'Consentement requis pour traiter votre retour' },
      { status: 400 },
    );
  }

  if (typeof type !== 'string' || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
  }

  if (typeof message !== 'string') {
    return NextResponse.json({ error: 'Message requis' }, { status: 400 });
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0 || trimmedMessage.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message requis (1-${MAX_MESSAGE} caractères)` },
      { status: 400 },
    );
  }

  let fromEmail = 'anonyme';
  if (typeof email === 'string' && email.trim().length > 0) {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > MAX_EMAIL || !EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }
    fromEmail = trimmedEmail;
  }

  const typeLabel = TYPE_LABELS[type];
  const safeMessage = escapeHtml(trimmedMessage);
  const safeEmail = escapeHtml(fromEmail);
  const safeTypeLabel = escapeHtml(typeLabel!);

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_placeholder') {
    console.error(`[feedback] RESEND_API_KEY missing (ipHash=${ipHash})`);
    return NextResponse.json(
      { error: 'Service temporairement indisponible' },
      { status: 503 },
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    await resend.emails.send({
      from: 'My Chronos Feedback <feedback@mychronos.fr>',
      to: 'contact@lexdigita.fr',
      subject: `[My Chronos] ${typeLabel} — retour utilisateur`,
      text: [
        `Type : ${typeLabel}`,
        `Email : ${fromEmail}`,
        `IP hash : ${ipHash}`,
        '',
        trimmedMessage,
      ].join('\n'),
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0a1628, #0055A4); padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">Nouveau retour My Chronos</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 14px;">${safeTypeLabel}</p>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
              <strong>Email :</strong> ${safeEmail}
            </p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 16px;">
              <p style="margin: 0; font-size: 15px; color: #1e293b; white-space: pre-wrap;">${safeMessage}</p>
            </div>
          </div>
        </div>
      `,
    });

    clearTimeout(timeoutId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Unknown';
    console.error(`[feedback] send failed (ipHash=${ipHash}, err=${name})`);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi" },
      { status: 500 },
    );
  }
}
