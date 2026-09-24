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

export function apiUrl(path: string): string {
  return isNativeApp() ? `${PROD_ORIGIN}${path}` : path;
}
