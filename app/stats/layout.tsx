import type { Metadata } from 'next';

// Manifeste propre : un raccourci « Ajouter à l'écran d'accueil » pris depuis
// /stats ouvre /stats, et non le manifeste de l'app (start_url /dashboard, qui
// renvoyait vers l'onboarding faute de données sur ce contexte).
export const metadata: Metadata = {
  title: 'Statistiques',
  robots: { index: false, follow: false },
  manifest: '/stats-manifest.json',
  appleWebApp: { capable: true, title: 'Chronos Stats', statusBarStyle: 'default' },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
