import type { CapacitorConfig } from '@capacitor/cli';

// Android : l'app charge le site en ligne (comme l'ancienne TWA, les mises à jour
// web arrivent sans passer par le Play Store), mais dans sa propre WebView : les
// données ne dépendent plus du navigateur du téléphone. iOS embarque l'export
// statique (`out`). `npx cap sync android` passe « android » en argument : c'est
// ce qui sélectionne la configuration Android, iOS reste inchangé.
const android = process.argv.includes('android') || process.env.CHRONOS_CIBLE === 'android';
// Test sur émulateur uniquement (site lancé sur le Mac, ex. http://10.0.2.2:3000/dashboard).
// Ne JAMAIS synchroniser avec cette variable avant un build envoyé au Play Store.
const urlTest = process.env.CHRONOS_ANDROID_URL;

const config: CapacitorConfig = {
  appId: 'fr.mychronos.app',
  appName: 'My Chronos',
  webDir: android ? 'android-web' : 'out',
  ...(android && {
    server: {
      url: urlTest ?? 'https://mychronos.fr/dashboard',
      ...(urlTest?.startsWith('http:') && { cleartext: true }),
      // Premier lancement sans réseau (ensuite, le service worker sert le cache).
      errorPath: 'hors-ligne.html',
    },
  }),
  ios: {
    // `contentInset` pilote `contentInsetAdjustmentBehavior` du UIScrollView
    // de la WKWebView. Il était forcé à 'always', ce qui ajoutait au scrollview
    // un encart de la hauteur de la safe-area : le contenu était poussé sous
    // l'encoche ET une zone défilable apparaissait en haut de l'écran (le
    // « mini scroll » avec un blanc trop grand ou trop faible).
    //
    // Le décalage était même compté DEUX fois, puisque le CSS applique déjà
    // `env(safe-area-inset-top)` via `.safe-top` sur le header.
    //
    // 'never' (le défaut Capacitor) laisse la webview occuper tout l'écran ;
    // combiné à `viewport-fit: cover` (app/layout.tsx), les valeurs `env(safe-area-inset-*)`
    // sont correctes et le CSS reste seul maître du décalage.
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
