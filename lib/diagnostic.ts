// Diagnostic anonyme des pertes de données sur Android et le web : dans l'app
// Android (TWA), les données vivent dans le navigateur du téléphone (Samsung
// Internet, Chrome…), qui peut les effacer. On relève, en catégories
// grossières jointes au profil des statistiques :
// - le navigateur hôte (samsung, chrome, edge, firefox, autre) ;
// - si le navigateur a accordé le « stockage protégé » (navigator.storage.persist).
// Rien sur l'iPhone : l'app y garde ses propres données (et une copie native).

let persistant: boolean | null = null;

/** À appeler au chargement : lit le statut du stockage protégé (asynchrone). */
export function initDiagnostic(): void {
  try {
    void navigator.storage?.persisted?.().then((v) => {
      persistant = v;
    });
  } catch {
    /* indisponible */
  }
}

export function navigateurHote(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/EdgA|Edg\//.test(ua)) return 'edge';
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (/Chrome|CriOS/.test(ua)) return 'chrome';
  return 'autre';
}

/** Clés de profil du diagnostic (vide sur l'app iPhone). */
export function profilDiagnostic(natif: boolean): string[] {
  if (natif) return [];
  const cles = [`nav:${navigateurHote()}`];
  if (persistant !== null) cles.push(`stockage:${persistant ? 'protege' : 'non_protege'}`);
  return cles;
}
