import type { Metadata } from 'next';
import { Transfert } from './Transfert';

export const metadata: Metadata = {
  title: 'Récupérer mes données — My Chronos',
  robots: { index: false, follow: false },
};

/**
 * Ouverte par l'app Android native dans le navigateur du téléphone : renvoie à
 * l'app les données de l'ancienne version, restées dans ce navigateur.
 */
export default function TransfertPage() {
  return (
    <main className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
      <Transfert />
    </main>
  );
}
