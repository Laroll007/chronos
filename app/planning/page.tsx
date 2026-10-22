import type { Metadata } from 'next';
import { PlanningPartage } from './PlanningPartage';

export const metadata: Metadata = {
  title: 'Planning partagé — My Chronos',
  description: 'Planning partagé depuis My Chronos.',
  robots: { index: false, follow: false },
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
