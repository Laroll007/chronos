import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startTime = Date.now();

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: APP_VERSION,
      uptime_seconds: Math.round((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
