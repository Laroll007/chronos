import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ClientErrorBoundary } from "@/components/shared/ClientErrorBoundary";
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mychronos.fr"),
  title: {
    default: "My Chronos — Gestion optimisée des congés policiers",
    template: "%s · My Chronos",
  },
  description:
    "Application libre pour les agents APORTT : CA, CA HP, RTC, CET, CF. Simulation et optimisation des combinaisons de congés. 100% local, sans compte.",
  applicationName: "My Chronos",
  manifest: "/manifest.json",
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "My Chronos",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "My Chronos",
    title: "My Chronos — Gestion optimisée des congés policiers",
    description:
      "Planifier, simuler, optimiser ses congés APORTT. 100% local, gratuit, sans compte.",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0055A4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" style={{ colorScheme: "light" }}>
      <head>
        <meta name="color-scheme" content="light" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.classList.remove('dark');localStorage.removeItem('chronos_theme')}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        {/* Skip link WCAG 2.4.1 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline focus:outline-2 focus:outline-white"
        >
          Aller au contenu principal
        </a>
        <ServiceWorkerRegistration />
        <ClientErrorBoundary>{children}</ClientErrorBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            className: "glass border-slate-200",
          }}
        />
      </body>
    </html>
  );
}
