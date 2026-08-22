import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.mychronos.app',
  appName: 'My Chronos',
  webDir: 'out',
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
