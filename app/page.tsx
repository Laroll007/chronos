import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "My Chronos — Gestion optimisée des congés policiers (APORTT)",
  description:
    "Application libre et gratuite pour les agents APORTT : calcul de CA, CA HP, RTC, CET, CF, simulation de congés, optimisation de combinaisons et planning. 100% local, sans compte ni tracking.",
  alternates: { canonical: "https://mychronos.fr/" },
  openGraph: {
    title: "My Chronos — Gestion optimisée des congés policiers",
    description:
      "Planifier, simuler, optimiser ses congés APORTT. Application 100% locale, gratuite, sans compte.",
    url: "https://mychronos.fr/",
    siteName: "My Chronos",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "My Chronos — Gestion optimisée des congés policiers",
    description:
      "Planifier, simuler, optimiser ses congés APORTT. 100% local, gratuit, sans compte.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "My Chronos",
  url: "https://mychronos.fr/",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, iOS, Android",
  inLanguage: "fr-FR",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  description:
    "Application de gestion et d'optimisation des congés pour les agents de la fonction publique soumis aux règles APORTT.",
};

// Script d'auto-redirect : les utilisateurs déjà onboardés (localStorage.chronos_data)
// vont directement au dashboard ; les nouveaux visiteurs voient la landing SEO.
// En Capacitor, on cible le fichier directement (`/dashboard/index.html`) pour
// éviter toute ambiguïté de résolution du scheme handler iOS. Sur le web,
// `/dashboard` est servi par Next.js / Nginx normalement.
const autoRedirectScript = `
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('chronos_data')) {
    var target = window.Capacitor ? '/dashboard/index.html' : '/dashboard';
    window.location.replace(target);
  }
} catch (e) {}
`;

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script dangerouslySetInnerHTML={{ __html: autoRedirectScript }} />

      <div className="min-h-screen bg-[#f8f9fc]">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(to right, #0055A4 33%, #fff 33%, #fff 66%, #EF4135 66%)",
          }}
        />

        <header className="max-w-4xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo My Chronos"
              width={44}
              height={44}
              priority
            />
            <span className="text-xl font-bold text-slate-800">My Chronos</span>
          </div>
          <nav aria-label="Navigation principale" className="flex items-center gap-4 text-sm">
            <Link href="/cgu" className="text-slate-600 hover:text-slate-900">
              CGU
            </Link>
            <Link href="/privacy" className="text-slate-600 hover:text-slate-900">
              Confidentialité
            </Link>
          </nav>
        </header>

        <main id="main" className="max-w-4xl mx-auto px-6 py-10">
          <section className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
              Gérez vos congés
              <br className="hidden sm:block" /> simplement et intelligemment.
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              CA, CA HP, RTC, CET, CF, HS, RPS. My Chronos calcule, simule et optimise
              vos combinaisons de congés pour éviter les jours perdus et maximiser
              votre CET — en toute autonomie.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-semibold shadow-lg transition-all hover:shadow-xl"
                style={{
                  background: "linear-gradient(135deg, #0055A4, #1a7de8)",
                }}
              >
                Commencer maintenant
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Gratuit · Sans compte · 100% local · Open source à terme
            </p>
          </section>

          <section className="mt-20 grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Calculs APORTT intégrés
              </h2>
              <p className="text-sm text-slate-600">
                Cycles 2/2/3/3, CA HP (4+4 → 2j bonus), CET (60j max, 15j/an),
                RTC réservés, CF lissé par semestre, journée de solidarité.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Optimisation des combinaisons
              </h2>
              <p className="text-sm text-slate-600">
                Sélectionnez une plage, My Chronos propose des combinaisons
                scorées sur priorité, éviter les pertes et préserver le CET.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                100% local, zéro tracker
              </h2>
              <p className="text-sm text-slate-600">
                Vos données restent dans votre navigateur. Aucun compte,
                aucun cookie de suivi, export/import en un clic.
              </p>
            </div>
          </section>

          <section className="mt-20 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Disponible partout
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              Progressive Web App (PWA) sur navigateur, application iOS via
              App Store et Android via Google Play — même code, mêmes calculs,
              mêmes données (si export/import).
            </p>
          </section>
        </main>

        <footer className="max-w-4xl mx-auto px-6 py-10 text-center text-xs text-slate-500 border-t border-slate-200 mt-16">
          © 2026 My Chronos — Application non officielle, usage personnel ·{" "}
          <Link href="/cgu" className="hover:text-slate-700 underline">
            CGU
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="hover:text-slate-700 underline">
            Confidentialité
          </Link>
        </footer>
      </div>
    </>
  );
}
