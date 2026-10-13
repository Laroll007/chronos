'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { APP_STORE, PLAY_STORE } from '@/lib/recommandation';

export function Redirection() {
  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) window.location.replace(APP_STORE);
    else if (/Android/.test(ua)) window.location.replace(PLAY_STORE);
  }, []);

  // Sur téléphone, le store s'ouvre aussitôt ; sur ordinateur, on reste ici.
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">My Chronos</h1>
      <p className="mt-1 text-sm text-slate-600">L’appli gratuite pour gérer tes congés APORTT</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique */}
      <img src="/qr-telecharger.svg" alt="QR code à scanner avec un téléphone" className="mx-auto mt-5 w-40 h-40" />
      <p className="mt-2 text-xs text-slate-500">Scanne ce code avec ton téléphone.</p>
      <div className="mt-5 grid gap-2">
        <a href={APP_STORE} className="h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center">
          App Store (iPhone)
        </a>
        <a href={PLAY_STORE} className="h-11 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center">
          Google Play (Android)
        </a>
        <Link href="/" className="h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-center">
          Utiliser la version web
        </Link>
      </div>
    </div>
  );
}
