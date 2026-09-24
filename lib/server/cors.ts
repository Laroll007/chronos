// CORS pour l'app iOS : sa WebView (Capacitor) a pour origine `capacitor://localhost`
// et appelle https://mychronos.fr/api/... en cross-origin.

const ALLOWED_ORIGINS = new Set(['capacitor://localhost', 'ionic://localhost']);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
