import type { Metadata } from 'next';
import { PlanningPartage } from './PlanningPartage';

export const metadata: Metadata = {
  title: 'Planning partagé — My Chronos',
  description: 'Planning partagé depuis My Chronos.',
  robots: { index: false, follow: false },
  // Aperçu prêt à l'emploi pour WhatsApp, Messages… (petite image carrée, légère)
  openGraph: {
    type: 'website',
    siteName: 'My Chronos',
    title: 'Planning partagé',
    description: 'Ouvrir pour voir le planning (lecture seule).',
    url: '/planning',
    images: [{ url: '/apercu-planning.png', width: 192, height: 192, alt: 'My Chronos' }],
  },
  twitter: { card: 'summary' },
};

/**
 * Ouverte par un lien « Partager mon planning » : le planning est dans le lien
 * (après #), lu dans le navigateur ; rien n'est envoyé au serveur.
 */
export default function PlanningPartagePage() {
  return (
    <main className="min-h-screen bg-[#f8f9fc]">
      <PlanningPartage />
    </main>
  );
}
