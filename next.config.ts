import type { NextConfig } from "next";

const isCapacitor = process.env.BUILD_TARGET === "capacitor";
const isProd = process.env.NODE_ENV === "production";

// CSP stricte en prod, relaxée en dev (React HMR utilise eval).
// connect-src : self (API interne) + api.resend.com (feedback).
// upgrade-insecure-requests uniquement en prod : casse le dev local HTTP sinon.
const csp = [
  "default-src 'self'",
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.resend.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', '192.168.1.90', '192.168.1.60', 'Amyo.local'],
  // Export statique pour Capacitor iOS/Android
  // images.unoptimized requis : Capacitor sert des fichiers locaux, pas de serveur Next.js
  // pour gérer /_next/image?url=... → next/image doit émettre un <img src> direct.
  ...(isCapacitor && {
    output: "export",
    images: { unoptimized: true },
    // Génère dashboard/index.html au lieu de dashboard.html : le scheme handler
    // Capacitor iOS résout `capacitor://localhost/dashboard` vers `dashboard/index.html`
    // (dossier → index.html), évitant un 404/fallback qui re-déclenchait le script
    // d'auto-redirect dans app/page.tsx → boucle de reload à la réouverture de la PWA.
    trailingSlash: true,
  }),
  ...(!isCapacitor && {
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
            { key: "Content-Security-Policy", value: csp },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
            { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ],
        },
        {
          source: "/_next/static/(.*)",
          headers: [
            { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
