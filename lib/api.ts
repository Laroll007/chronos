// Adresse des routes /api selon l'environnement.
//
// Dans l'app iOS (Capacitor), la page est servie depuis `capacitor://localhost` :
// un `fetch('/api/...')` relatif n'atteint jamais le serveur. Il faut viser
// l'origine de production, qui autorise cette origine en CORS.

const PROD_ORIGIN = 'https://mychronos.fr';

// `window.Capacitor` existe aussi sur le web dès que `@capacitor/core` est chargé
// (cf. native-backup) : seul `isNativePlatform()` distingue l'app native.
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** App native : 'ios' (export embarqué) ou 'android' (WebView sur mychronos.fr) ; null sur le web. */
export function plateformeNative(): 'ios' | 'android' | null {
  if (!isNativeApp()) return null;
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() === 'android' ? 'android' : 'ios';
}

// L'app Android charge le site lui-même : chemin relatif, comme sur le web.
export function apiUrl(path: string): string {
  return plateformeNative() === 'ios' ? `${PROD_ORIGIN}${path}` : path;
}
