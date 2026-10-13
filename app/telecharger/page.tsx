import type { Metadata } from 'next';
import { Redirection } from './Redirection';

export const metadata: Metadata = {
  title: 'Télécharger My Chronos',
  description: 'L’appli gratuite pour gérer ses congés APORTT : App Store, Google Play ou version web.',
};

/**
 * Lien unique de recommandation (QR code, partage) : un iPhone part vers
 * l'App Store, un Android vers Google Play ; ailleurs, les deux liens.
 */
export default function TelechargerPage() {
  return (
    <main className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
      <Redirection />
    </main>
  );
}
