// Server Component — le shell statique (logo, fond) est rendu en HTML immédiatement.
import Image from 'next/image';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 15% 40%, rgba(0,85,164,0.07) 0%, transparent 50%),
          radial-gradient(ellipse at 85% 20%, rgba(239,65,53,0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 90%, rgba(0,85,164,0.05) 0%, transparent 50%),
          #f8f9fc
        `,
      }}
    >
      {/* Bandeau top avec safe-area (opaque, masque le contenu qui scrolle derrière) */}
      <div className="shrink-0 safe-top" style={{ background: '#f8f9fc' }}>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #0055A4 33.3%, #ffffff 33.3%, #ffffff 66.6%, #EF4135 66.6%)' }} />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto safe-x">
        <div className="container max-w-lg mx-auto px-4 py-8 pb-safe-plus-4">
          {/* Logo */}
          <div className="text-center mb-6">
            <Image
              src="/icons/icon-192x192.png"
              alt="Logo My Chronos"
              width={88}
              height={88}
              priority
              fetchPriority="high"
              className="rounded-2xl mb-3 shadow-lg mx-auto"
              style={{ boxShadow: '0 8px 24px rgba(0,85,164,0.25)' }}
            />
            <h1
              className="text-4xl font-bold mb-2"
              style={{
                background: 'linear-gradient(135deg, #0055A4, #1a7de8 40%, #ffffff 50%, #EF4135 60%, #c0392b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              My Chronos
            </h1>
            <p className="text-slate-500">Optimisez la gestion de vos congés</p>
          </div>

          <OnboardingWizard />
        </div>
      </main>
    </div>
  );
}
